import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../../../config/environment.js';

const SIGNATURE_PREFIX = 'sha256=';

/**
 * Proves a webhook comes from Meta.
 *
 * - `X-Hub-Signature-256` is an HMAC-SHA256 of the **raw** body with the app
 *   secret. The parsed JSON cannot be used: re-serializing it changes bytes.
 * - Comparisons are constant-time.
 * - Without a configured secret or verify token everything is rejected: a
 *   missing variable must never mean "accept anything".
 */
@Injectable()
export class MetaWebhookVerifier {
  private readonly appSecret: string;
  private readonly verifyToken: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.appSecret = config.get('WHATSAPP_APP_SECRET', { infer: true });
    this.verifyToken = config.get('WHATSAPP_VERIFY_TOKEN', { infer: true });
  }

  hasValidSignature(
    rawBody: Buffer | undefined,
    header: string | undefined,
  ): boolean {
    if (!this.appSecret || !rawBody || !header?.startsWith(SIGNATURE_PREFIX)) {
      return false;
    }

    const expected = createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest();
    const received = Buffer.from(header.slice(SIGNATURE_PREFIX.length), 'hex');

    return (
      received.length === expected.length && timingSafeEqual(received, expected)
    );
  }

  /** The subscription handshake: Meta echoes the token we gave it. */
  isValidSubscription(
    mode: string | undefined,
    token: string | undefined,
  ): boolean {
    if (!this.verifyToken || mode !== 'subscribe' || token === undefined) {
      return false;
    }

    const expected = Buffer.from(this.verifyToken, 'utf8');
    const received = Buffer.from(token, 'utf8');

    return (
      received.length === expected.length && timingSafeEqual(received, expected)
    );
  }
}
