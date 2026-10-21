import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { Clock } from '../../../../shared/application/ports/clock.port.js';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner.port.js';
import type { UserRole } from '../../../../shared/domain/user-role.js';
import { TenantRepository } from '../../../tenants/domain/tenant.repository.js';
import {
  InvalidRefreshTokenError,
  NotAMemberError,
} from '../../domain/errors/authentication.errors.js';
import { MembershipRepository } from '../../domain/membership.repository.js';
import { RefreshTokenRepository } from '../ports/refresh-token.repository.js';
import { SecureTokenFactory } from '../ports/secure-token-factory.port.js';
import { SessionIssuer, type IssuedSession } from '../session-issuer.js';

export interface SwitchTenantInput {
  readonly tenantId: string;
  readonly refreshToken: string;
}

export interface SwitchTenantResult {
  readonly tenantId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly role: UserRole;
  readonly session: IssuedSession;
}

@Injectable()
export class SwitchTenantUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly memberships: MembershipRepository,
    private readonly tenants: TenantRepository,
    private readonly tokenFactory: SecureTokenFactory,
    private readonly sessionIssuer: SessionIssuer,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  async execute(
    actor: AuthContext,
    input: SwitchTenantInput,
  ): Promise<SwitchTenantResult> {
    const stored = await this.refreshTokens.findByHash(
      this.tokenFactory.hash(input.refreshToken),
    );

    if (!stored || stored.userId !== actor.userId) {
      throw new InvalidRefreshTokenError();
    }

    const membership = await this.memberships.findByTenantAndUser(
      input.tenantId,
      actor.userId,
    );
    const tenant = await this.tenants.findById(input.tenantId);

    if (!membership?.isActive || !tenant?.isActive) {
      throw new NotAMemberError();
    }

    return this.transaction.run(async () => {
      const now = this.clock.now();

      const session = await this.sessionIssuer.issue({
        userId: actor.userId,
        tenantId: membership.tenantId,
        membershipId: membership.id,
      });

      await this.refreshTokens.revokeFamily(stored.familyId, now);

      return {
        tenantId: membership.tenantId,
        userId: actor.userId,
        membershipId: membership.id,
        role: membership.role,
        session,
      };
    });
  }
}
