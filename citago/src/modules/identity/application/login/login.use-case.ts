import { Injectable } from '@nestjs/common';

import { Email } from '../../../../shared/domain/email.js';
import type { UserRole } from '../../../../shared/domain/user-role.js';
import { TenantRepository } from '../../../tenants/domain/tenant.repository.js';
import {
  InvalidCredentialsError,
  NoActiveMembershipError,
} from '../../domain/errors/authentication.errors.js';
import { MembershipRepository } from '../../domain/membership.repository.js';
import { UserRepository } from '../../domain/user.repository.js';
import { PasswordHasher } from '../ports/password-hasher.port.js';
import { SessionIssuer, type IssuedSession } from '../session-issuer.js';

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface LoginResult {
  readonly tenantId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly role: UserRole;
  readonly session: IssuedSession;
}

/**
 * An argon2id hash of a value nobody knows.
 *
 * Verified when the email does not exist so that a missing account costs the
 * same time as a wrong password: otherwise response times would reveal which
 * emails are registered.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$Iq0ynGQTz8PP0IFcxhwMJiOeGbYj1P8uSQZdXJmmvHM';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly memberships: MembershipRepository,
    private readonly tenants: TenantRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionIssuer: SessionIssuer,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const email = Email.create(input.email);
    const user = await this.users.findByEmail(email);

    const passwordMatches = await this.passwordHasher.verify(
      user?.passwordHash ?? DUMMY_HASH,
      input.password,
    );

    if (!user || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const membership = await this.resolveMembership(user.id);

    const session = await this.sessionIssuer.issue({
      userId: user.id,
      tenantId: membership.tenantId,
      membershipId: membership.id,
    });

    return {
      tenantId: membership.tenantId,
      userId: user.id,
      membershipId: membership.id,
      role: membership.role,
      session,
    };
  }

  /**
   * Picks the business this sign-in enters.
   *
   * The data model already supports a person working at several businesses,
   * but the MVP has no tenant switcher: the oldest active membership whose
   * tenant is active wins. Adding `POST /auth/switch-tenant` later only needs
   * to reissue the pair for another membership.
   */
  private async resolveMembership(userId: string) {
    const memberships = await this.memberships.findActiveByUserId(userId);

    for (const membership of memberships) {
      const tenant = await this.tenants.findById(membership.tenantId);

      if (tenant?.isActive) {
        return membership;
      }
    }

    throw new NoActiveMembershipError();
  }
}
