import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../../config/environment.js';
import { Clock } from '../../application/ports/clock.port.js';
import {
  HandoffTokens,
  type HandoffClaims,
  type HandoffPurpose,
} from '../../application/ports/handoff-tokens.port.js';

const VERSION = 'v1';
const TTL_SECONDS = 15 * 60;
const PURPOSES: readonly HandoffPurpose[] = ['whatsapp-signup', 'checkout'];

interface Payload {
  readonly t: string;
  readonly u: string;
  readonly p: HandoffPurpose;
  readonly e: number;
  readonly s?: string;
}

/**
 * `v1.<payload>.<signature>`, HMAC-SHA256. The key is derived from the JWT
 * secret under its own label, so a handoff token can never be mistaken for
 * (or forged from) an access token, and the formats do not overlap.
 */
@Injectable()
export class HmacHandoffTokens extends HandoffTokens {
  readonly ttlSeconds = TTL_SECONDS;
  private readonly key: Buffer;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly clock: Clock,
  ) {
    super();
    this.key = createHmac(
      'sha256',
      config.get('JWT_ACCESS_SECRET', { infer: true }),
    )
      .update('citago:handoff-token:v1')
      .digest();
  }

  issue(claims: HandoffClaims): string {
    const payload: Payload = {
      t: claims.tenantId,
      u: claims.userId,
      p: claims.purpose,
      e: Math.floor(this.clock.now().getTime() / 1000) + TTL_SECONDS,
      ...(claims.subject === undefined ? {} : { s: claims.subject }),
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');

    return `${VERSION}.${body}.${this.sign(body)}`;
  }

  verify(token: string, purpose: HandoffPurpose): HandoffClaims | null {
    const parts = token.split('.');

    if (parts.length !== 3 || parts[0] !== VERSION) {
      return null;
    }

    const [, body, signature] = parts;
    const expected = Buffer.from(this.sign(body));
    const actual = Buffer.from(signature);

    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return null;
    }

    const payload = parsePayload(body);

    if (
      !payload ||
      payload.p !== purpose ||
      payload.e <= Math.floor(this.clock.now().getTime() / 1000)
    ) {
      return null;
    }

    return {
      tenantId: payload.t,
      userId: payload.u,
      purpose: payload.p,
      ...(payload.s === undefined ? {} : { subject: payload.s }),
    };
  }

  private sign(body: string): string {
    return createHmac('sha256', this.key).update(body).digest('base64url');
  }
}

function parsePayload(body: string): Payload | null {
  try {
    const value = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as Partial<Payload>;

    if (
      typeof value.t === 'string' &&
      typeof value.u === 'string' &&
      typeof value.e === 'number' &&
      (value.s === undefined || typeof value.s === 'string') &&
      PURPOSES.includes(value.p as HandoffPurpose)
    ) {
      return value as Payload;
    }
  } catch {
    // Falls through: a body that is not JSON is simply not ours.
  }

  return null;
}
