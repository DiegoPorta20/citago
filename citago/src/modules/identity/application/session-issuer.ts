import { Injectable } from '@nestjs/common';

import { Clock } from '../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../shared/application/ports/id-generator.port.js';
import { AccessTokenService } from './ports/access-token.service.js';
import { RefreshTokenRepository } from './ports/refresh-token.repository.js';
import { SecureTokenFactory } from './ports/secure-token-factory.port.js';
import { SessionPolicy } from './ports/session-policy.port.js';

export interface IssuedSession {
  readonly accessToken: string;
  readonly accessTokenExpiresInSeconds: number;
  readonly refreshToken: string;
  readonly refreshTokenId: string;
}

export interface IssueSessionInput {
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  /**
   * Existing rotation family, when refreshing. Omitted on a fresh sign-in,
   * which starts a new family.
   */
  readonly familyId?: string;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Creates the token pair for a session and stores the refresh side.
 *
 * Shared by sign-up, sign-in and refresh so the three cannot drift apart:
 * one place decides what a session is.
 */
@Injectable()
export class SessionIssuer {
  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokenFactory: SecureTokenFactory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly policy: SessionPolicy,
  ) {}

  async issue(input: IssueSessionInput): Promise<IssuedSession> {
    const now = this.clock.now();
    const refreshTokenId = this.ids.generate();
    const generated = this.tokenFactory.create();

    await this.refreshTokens.insert({
      id: refreshTokenId,
      userId: input.userId,
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      tokenHash: generated.hash,
      familyId: input.familyId ?? this.ids.generate(),
      expiresAt: new Date(
        now.getTime() + this.policy.refreshTokenTtlDays * MILLISECONDS_PER_DAY,
      ),
      createdAt: now,
    });

    const accessToken = await this.accessTokens.issue({
      sub: input.userId,
      tid: input.tenantId,
      mid: input.membershipId,
    });

    return {
      accessToken,
      accessTokenExpiresInSeconds: this.accessTokens.expiresInSeconds,
      refreshToken: generated.value,
      refreshTokenId,
    };
  }
}
