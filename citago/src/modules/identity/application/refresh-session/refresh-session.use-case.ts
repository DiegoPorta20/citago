import { Injectable, Logger } from '@nestjs/common';

import { Clock } from '../../../../shared/application/ports/clock.port.js';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner.port.js';
import type { UserRole } from '../../../../shared/domain/user-role.js';
import { TenantRepository } from '../../../tenants/domain/tenant.repository.js';
import { InvalidRefreshTokenError } from '../../domain/errors/authentication.errors.js';
import { MembershipRepository } from '../../domain/membership.repository.js';
import {
  RefreshTokenRepository,
  type StoredRefreshToken,
} from '../ports/refresh-token.repository.js';
import { SecureTokenFactory } from '../ports/secure-token-factory.port.js';
import { SessionIssuer, type IssuedSession } from '../session-issuer.js';

export interface RefreshSessionInput {
  readonly refreshToken: string;
}

export interface RefreshSessionResult {
  readonly tenantId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly role: UserRole;
  readonly session: IssuedSession;
}

/**
 * Exchanges a refresh token for a new pair, rotating it.
 *
 * Every failure returns the same error: a caller probing tokens learns nothing
 * about why one was rejected.
 *
 * Access is re-checked here, not just at sign-in — a revoked membership or a
 * suspended business cannot be kept alive by refreshing.
 */
@Injectable()
export class RefreshSessionUseCase {
  private readonly logger = new Logger(RefreshSessionUseCase.name);

  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly memberships: MembershipRepository,
    private readonly tenants: TenantRepository,
    private readonly tokenFactory: SecureTokenFactory,
    private readonly sessionIssuer: SessionIssuer,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  async execute(input: RefreshSessionInput): Promise<RefreshSessionResult> {
    const stored = await this.refreshTokens.findByHash(
      this.tokenFactory.hash(input.refreshToken),
    );

    if (!stored) {
      throw new InvalidRefreshTokenError();
    }

    await this.assertUsable(stored);

    const membership = await this.memberships.findByIdForTenant(
      stored.membershipId,
      stored.tenantId,
    );
    const tenant = await this.tenants.findById(stored.tenantId);

    if (!membership?.isActive || !tenant?.isActive) {
      await this.refreshTokens.revokeFamily(stored.familyId, this.clock.now());
      throw new InvalidRefreshTokenError();
    }

    return this.transaction.run(async () => {
      const session = await this.sessionIssuer.issue({
        userId: stored.userId,
        tenantId: stored.tenantId,
        membershipId: stored.membershipId,
        familyId: stored.familyId,
      });

      await this.refreshTokens.markRotated(
        stored.id,
        session.refreshTokenId,
        this.clock.now(),
      );

      return {
        tenantId: stored.tenantId,
        userId: stored.userId,
        membershipId: stored.membershipId,
        role: membership.role,
        session,
      };
    });
  }

  private async assertUsable(stored: StoredRefreshToken): Promise<void> {
    const now = this.clock.now();

    // Reuse detection: a token that was already rotated or revoked is being
    // replayed, which means it leaked. The whole rotation chain dies, so the
    // legitimate holder is signed out too and has to authenticate again.
    if (stored.revokedAt !== null || stored.replacedById !== null) {
      this.logger.warn(
        `Refresh token reuse detected for family ${stored.familyId}; revoking it`,
      );
      await this.refreshTokens.revokeFamily(stored.familyId, now);
      throw new InvalidRefreshTokenError();
    }

    if (stored.expiresAt.getTime() <= now.getTime()) {
      throw new InvalidRefreshTokenError();
    }
  }
}
