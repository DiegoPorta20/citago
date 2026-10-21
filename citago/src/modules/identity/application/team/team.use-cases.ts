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

const TEMPORARY_PASSWORD_LENGTH = 16;

export interface TeamMemberView {
  readonly membership: Membership;
  readonly user: User;
}

export interface AddTeamMemberInput {
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly password?: string | null;
}

export interface AddedTeamMember {
  readonly member: TeamMemberView;
  readonly temporaryPassword: string | null;
}

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

      return user ? [{ membership, user }] : [];
    });
  }
}

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
      temporaryPassword: input.password ? null : generated,
      isNew: true,
    };
  }

  private generatePassword(): string {
    let value = '';

    while (value.length < TEMPORARY_PASSWORD_LENGTH) {
      value += this.tokens.create().value;
    }

    return value.slice(0, TEMPORARY_PASSWORD_LENGTH);
  }
}

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
