import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { EnvironmentVariables } from '../../../../config/environment.js';
import {
  AccessTokenService,
  type AccessTokenClaims,
} from '../../application/ports/access-token.service.js';

interface RawClaims {
  sub?: unknown;
  tid?: unknown;
  mid?: unknown;
}

@Injectable()
export class JwtAccessTokenService extends AccessTokenService {
  private readonly logger = new Logger(JwtAccessTokenService.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    super();
    this.ttlSeconds = config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
  }

  get expiresInSeconds(): number {
    return this.ttlSeconds;
  }

  async issue(claims: AccessTokenClaims): Promise<string> {
    return this.jwt.signAsync(
      { sub: claims.sub, tid: claims.tid, mid: claims.mid },
      { expiresIn: this.ttlSeconds },
    );
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const payload = await this.jwt.verifyAsync<RawClaims>(token);

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.tid !== 'string' ||
        typeof payload.mid !== 'string'
      ) {
        return null;
      }

      return { sub: payload.sub, tid: payload.tid, mid: payload.mid };
    } catch {
      this.logger.debug('Rejected an access token');
      return null;
    }
  }
}
