import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { Clock } from '../../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../../shared/application/ports/id-generator.port.js';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner.port.js';
import { Email } from '../../../../shared/domain/email.js';
import { UserRole } from '../../../../shared/domain/user-role.js';
import {
  CannotChangeOwnAccessError,
  LastOwnerError,
  MembershipNotFoundError,
  RoleChangeNotAllowedError,
  UserAlreadyInTeamError,
} from '../../domain/errors/team.errors.js';
import { Membership } from '../../domain/membership.entity.js';
import { MembershipRepository } from '../../domain/membership.repository.js';
import { User } from '../../domain/user.entity.js';
import { UserRepository } from '../../domain/user.repository.js';
import { PasswordHasher } from '../ports/password-hasher.port.js';
import { SecureTokenFactory } from '../ports/secure-token-factory.port.js';

/**
 * Long enough to be safe to hand over once, short enough to type, and never
 * below the minimum the API accepts when a password is chosen by hand.
 */
const TEMPORARY_PASSWORD_LENGTH = 16;

/** One person's access to this business. */
export interface TeamMemberView {
  readonly membership: Membership;
  readonly user: User;
}

export interface AddTeamMemberInput {
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  /** Chosen by the inviter; left out, one is generated and returned once. */
  readonly password?: string | null;
}

export interface AddedTeamMember {
  readonly member: TeamMemberView;
  /**
   * Shown **once**, at creation, and never stored in plain text. Absent when
   * the person already had an account: they keep the password they have.
   */
  readonly temporaryPassword: string | null;
}

/**
 * Who may act on whose access (docs/permissions.md).
 *
 * The coarse check at the controller only says "OWNER and ADMIN may manage
 * users". This is the other half: an ADMIN administers STAFF, and nobody but an
 * OWNER creates or withdraws an OWNER or an ADMIN — an administrator cannot
 * promote themselves past their own ceiling, nor remove the person who hired
 * them.
 */
@Injectable()
export class TeamPolicy {
  assertCanGrant(actor: AuthContext, role: UserRole): void {
    if (actor.role !== UserRole.Owner && role !== UserRole.Staff) {
      throw new RoleChangeNotAllowedError();
    }
  }

  assertCanManage(actor: AuthContext, membership: Membership): void {
    if (membership.userId === actor.userId) {
      throw new CannotChangeOwnAccessError();
    }

    if (actor.role !== UserRole.Owner && membership.role !== UserRole.Staff) {
      throw new RoleChangeNotAllowedError();
    }
  }
}

@Injectable()
export class ListTeamMembersUseCase {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(actor: AuthContext): Promise<TeamMemberView[]> {
    const memberships = await this.memberships.listByTenant(actor.tenantId);
    const users = await this.users.findManyByIds([
      ...new Set(memberships.map((membership) => membership.userId)),
    ]);
    const userById = new Map(users.map((user) => [user.id, user]));

    return memberships.flatMap((membership) => {
      const user = userById.get(membership.userId);

      // A membership without its account would be a broken foreign key; skip
      // it rather than inventing a row for a screen.
      return user ? [{ membership, user }] : [];
    });
  }
}

/**
 * Gives someone access to the business.
 *
 * There is no email delivery in the MVP (and adding a mail service to send one
 * invitation would be the wrong trade), so access is granted directly: the
 * inviter either sets a password or gets a generated one to hand over. Either
 * way the plain value never leaves this use case except in its own response,
 * and only the argon2id hash is stored.
 *
 * An email that already has an account is **attached**, not duplicated: a
 * barber who works at two shops is one person with two memberships. Their
 * existing sign-in is untouched, and login still enters their oldest business
 * until a tenant switcher exists.
 */
@Injectable()
export class AddTeamMemberUseCase {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: SecureTokenFactory,
    private readonly policy: TeamPolicy,
    private readonly transaction: TransactionRunner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: AddTeamMemberInput,
  ): Promise<AddedTeamMember> {
    this.policy.assertCanGrant(actor, input.role);

    const email = Email.create(input.email);
    const existing = await this.users.findByEmail(email);
    // Hashing is deliberately slow, so it happens **before** the transaction
    // opens rather than holding a write lock while argon2 runs.
    const account = existing
      ? { user: existing, temporaryPassword: null, isNew: false }
      : await this.newAccount(email, input);

    return this.transaction.run(async () => {
      const current = await this.memberships.findByTenantAndUser(
        actor.tenantId,
        account.user.id,
      );

      if (current) {
        throw new UserAlreadyInTeamError(current.id, current.status);
      }

      const membership = Membership.create(
        {
          id: this.ids.generate(),
          tenantId: actor.tenantId,
          userId: account.user.id,
          role: input.role,
        },
        this.clock.now(),
      );

      if (account.isNew) {
        await this.users.save(account.user);
      }
      await this.memberships.save(membership);

      return {
        member: { membership, user: account.user },
        temporaryPassword: account.temporaryPassword,
      };
    });
  }

  private async newAccount(
    email: Email,
    input: AddTeamMemberInput,
  ): Promise<{
    user: User;
    temporaryPassword: string | null;
    isNew: true;
  }> {
    const generated = this.generatePassword();
    const password = input.password ?? generated;

    return {
      user: User.create(
        {
          id: this.ids.generate(),
          email,
          passwordHash: await this.passwordHasher.hash(password),
          name: input.name,
        },
        this.clock.now(),
      ),
      // The inviter who chose the password already knows it.
      temporaryPassword: input.password ? null : generated,
      isNew: true,
    };
  }

  /**
   * `SecureTokenFactory` promises unpredictability, not a length, so the
   * password is built up to the length this use case needs instead of trusting
   * whatever one token happens to be.
   */
  private generatePassword(): string {
    let value = '';

    while (value.length < TEMPORARY_PASSWORD_LENGTH) {
      value += this.tokens.create().value;
    }

    return value.slice(0, TEMPORARY_PASSWORD_LENGTH);
  }
}

/**
 * Changes what someone may do, or whether they may enter at all.
 *
 * Both actions live together because they share the rule that matters: the
 * business must never be left without an active OWNER (rule ID-1). Losing the
 * last one is not recoverable through the API — there is nobody left who could
 * undo it.
 *
 * Over HTTP the count below is defence in depth, and deliberately so: only an
 * OWNER can withdraw an OWNER, and nobody can act on themselves (rule ID-7), so
 * an active owner is always left standing. The check stays because it is the
 * rule itself, and because the day one of those two guards is relaxed — "an
 * owner may step down" is a plausible request — this is what keeps a business
 * from becoming unadministrable.
 */
@Injectable()
export class ChangeTeamMemberAccessUseCase {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly users: UserRepository,
    private readonly policy: TeamPolicy,
    private readonly transaction: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  changeRole(
    actor: AuthContext,
    membershipId: string,
    role: UserRole,
  ): Promise<TeamMemberView> {
    return this.apply(actor, membershipId, (membership, now) => {
      this.policy.assertCanGrant(actor, role);
      membership.changeRole(role, now);
    });
  }

  revoke(actor: AuthContext, membershipId: string): Promise<TeamMemberView> {
    return this.apply(actor, membershipId, (membership, now) => {
      membership.deactivate(now);
    });
  }

  restore(actor: AuthContext, membershipId: string): Promise<TeamMemberView> {
    return this.apply(actor, membershipId, (membership, now) => {
      this.policy.assertCanGrant(actor, membership.role);
      membership.activate(now);
    });
  }

  private async apply(
    actor: AuthContext,
    membershipId: string,
    change: (membership: Membership, now: Date) => void,
  ): Promise<TeamMemberView> {
    return this.transaction.run(async () => {
      const membership = await this.memberships.findByIdForTenant(
        membershipId,
        actor.tenantId,
      );

      if (!membership) {
        throw new MembershipNotFoundError();
      }

      this.policy.assertCanManage(actor, membership);

      const wasActiveOwner =
        membership.isActive && membership.role === UserRole.Owner;
      // Counted **before** the change, so the figure includes this membership
      // and the rule reads the same whether or not the change is flushed yet.
      const activeOwners = wasActiveOwner
        ? await this.memberships.countActiveByRole(
            actor.tenantId,
            UserRole.Owner,
          )
        : 0;

      change(membership, this.clock.now());

      const stillActiveOwner =
        membership.isActive && membership.role === UserRole.Owner;

      if (wasActiveOwner && !stillActiveOwner && activeOwners <= 1) {
        throw new LastOwnerError();
      }

      await this.memberships.save(membership);

      const user = await this.users.findById(membership.userId);

      if (!user) {
        throw new MembershipNotFoundError();
      }

      return { membership, user };
    });
  }
}
