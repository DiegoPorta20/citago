import { Injectable } from '@nestjs/common';

import { Clock } from '../../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../../shared/application/ports/id-generator.port.js';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner.port.js';
import { Email } from '../../../../shared/domain/email.js';
import { UserRole } from '../../../../shared/domain/user-role.js';
import { BusinessType } from '../../../tenants/domain/business-type.js';
import { Tenant } from '../../../tenants/domain/tenant.entity.js';
import { TenantRepository } from '../../../tenants/domain/tenant.repository.js';
import { EmailAlreadyRegisteredError } from '../../domain/errors/authentication.errors.js';
import { Membership } from '../../domain/membership.entity.js';
import { MembershipRepository } from '../../domain/membership.repository.js';
import { User } from '../../domain/user.entity.js';
import { UserRepository } from '../../domain/user.repository.js';
import { PasswordHasher } from '../ports/password-hasher.port.js';
import { SessionIssuer, type IssuedSession } from '../session-issuer.js';
import { buildSlugCandidates } from './slug.js';

export interface RegisterBusinessInput {
  readonly businessName: string;
  readonly businessType?: BusinessType;
  readonly country: string;
  readonly currency: string;
  readonly timezone: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly password: string;
}

export interface RegisterBusinessResult {
  readonly tenantId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly role: UserRole;
  readonly session: IssuedSession;
}

/**
 * Signs up a business and its first user.
 *
 * Creates the tenant, the account and the OWNER membership **atomically**:
 * a half-finished sign-up would leave an account that cannot enter anywhere.
 *
 * This is also where business rule ID-1 starts holding — every tenant is born
 * with exactly one active OWNER.
 */
@Injectable()
export class RegisterBusinessUseCase {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly users: UserRepository,
    private readonly memberships: MembershipRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionIssuer: SessionIssuer,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  async execute(input: RegisterBusinessInput): Promise<RegisterBusinessResult> {
    const email = Email.create(input.ownerEmail);

    if (await this.users.existsByEmail(email)) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    return this.transaction.run(async () => {
      const now = this.clock.now();

      const tenant = Tenant.create(
        {
          id: this.ids.generate(),
          name: input.businessName,
          slug: await this.resolveSlug(input.businessName),
          businessType: input.businessType ?? BusinessType.Barbershop,
          country: input.country,
          currency: input.currency,
          timezone: input.timezone,
        },
        now,
      );

      const user = User.create(
        {
          id: this.ids.generate(),
          email,
          passwordHash,
          name: input.ownerName,
        },
        now,
      );

      const membership = Membership.create(
        {
          id: this.ids.generate(),
          tenantId: tenant.id,
          userId: user.id,
          role: UserRole.Owner,
        },
        now,
      );

      await this.tenants.save(tenant);
      await this.users.save(user);
      await this.memberships.save(membership);

      const session = await this.sessionIssuer.issue({
        userId: user.id,
        tenantId: tenant.id,
        membershipId: membership.id,
      });

      return {
        tenantId: tenant.id,
        userId: user.id,
        membershipId: membership.id,
        role: membership.role,
        session,
      };
    });
  }

  /**
   * Slugs are globally unique, so two businesses with the same name need
   * distinct handles. Tries `barberia-lima`, then `barberia-lima-2`, and so on.
   */
  private async resolveSlug(businessName: string): Promise<string> {
    for (const candidate of buildSlugCandidates(businessName)) {
      if (!(await this.tenants.existsBySlug(candidate))) {
        return candidate;
      }
    }

    // Exhausting every candidate means a pathological amount of collisions;
    // a random suffix ends the loop rather than failing the sign-up.
    return `${buildSlugCandidates(businessName)[0]}-${this.ids
      .generate()
      .slice(0, 8)}`;
  }
}
