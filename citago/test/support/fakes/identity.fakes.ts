import { Clock } from '../../../src/shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../src/shared/application/ports/id-generator.port.js';
import { TransactionRunner } from '../../../src/shared/application/ports/transaction-runner.port.js';
import type { Email } from '../../../src/shared/domain/email.js';
import { MembershipStatus } from '../../../src/modules/identity/domain/membership-status.js';
import type { Membership } from '../../../src/modules/identity/domain/membership.entity.js';
import { MembershipRepository } from '../../../src/modules/identity/domain/membership.repository.js';
import type { User } from '../../../src/modules/identity/domain/user.entity.js';
import { UserRepository } from '../../../src/modules/identity/domain/user.repository.js';
import {
  AccessTokenService,
  type AccessTokenClaims,
} from '../../../src/modules/identity/application/ports/access-token.service.js';
import { PasswordHasher } from '../../../src/modules/identity/application/ports/password-hasher.port.js';
import {
  RefreshTokenRepository,
  type NewRefreshToken,
  type StoredRefreshToken,
} from '../../../src/modules/identity/application/ports/refresh-token.repository.js';
import {
  SecureTokenFactory,
  type GeneratedToken,
} from '../../../src/modules/identity/application/ports/secure-token-factory.port.js';
import { SessionPolicy } from '../../../src/modules/identity/application/ports/session-policy.port.js';
import type { UserRole } from '../../../src/shared/domain/user-role.js';
import type { Tenant } from '../../../src/modules/tenants/domain/tenant.entity.js';
import { TenantRepository } from '../../../src/modules/tenants/domain/tenant.repository.js';

/**
 * Hand-written fakes, not mocks.
 *
 * A mock returning whatever the test expects would happily hide a repository
 * that forgot its tenant filter. These behave like the real thing — including
 * tenant scoping — so a use case that misuses them fails here.
 */

export class InMemoryUserRepository extends UserRepository {
  readonly users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.value === email.value) {
        return user;
      }
    }

    return null;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
}

export class InMemoryMembershipRepository extends MembershipRepository {
  readonly memberships = new Map<string, Membership>();

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Membership | null> {
    const membership = this.memberships.get(id);

    // Tenant scoping is part of the contract, so the fake honours it too.
    return membership && membership.tenantId === tenantId ? membership : null;
  }

  async findActiveByUserId(userId: string): Promise<Membership[]> {
    return [...this.memberships.values()]
      .filter(
        (membership) =>
          membership.userId === userId &&
          membership.status === MembershipStatus.Active,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async findByTenantAndUser(
    tenantId: string,
    userId: string,
  ): Promise<Membership | null> {
    return (
      [...this.memberships.values()].find(
        (membership) =>
          membership.tenantId === tenantId && membership.userId === userId,
      ) ?? null
    );
  }

  async countActiveByRole(tenantId: string, role: UserRole): Promise<number> {
    return [...this.memberships.values()].filter(
      (membership) =>
        membership.tenantId === tenantId &&
        membership.role === role &&
        membership.status === MembershipStatus.Active,
    ).length;
  }

  async save(membership: Membership): Promise<void> {
    this.memberships.set(membership.id, membership);
  }
}

export class InMemoryTenantRepository extends TenantRepository {
  readonly tenants = new Map<string, Tenant>();

  async findById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) ?? null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return [...this.tenants.values()].some((tenant) => tenant.slug === slug);
  }

  async save(tenant: Tenant): Promise<void> {
    this.tenants.set(tenant.id, tenant);
  }
}

export class InMemoryRefreshTokenRepository extends RefreshTokenRepository {
  readonly tokens = new Map<string, StoredRefreshToken>();

  async insert(token: NewRefreshToken): Promise<void> {
    this.tokens.set(token.id, {
      ...token,
      revokedAt: null,
      replacedById: null,
    });
  }

  async findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    return (
      [...this.tokens.values()].find(
        (token) => token.tokenHash === tokenHash,
      ) ?? null
    );
  }

  async markRotated(
    id: string,
    replacedById: string,
    rotatedAt: Date,
  ): Promise<void> {
    const token = this.tokens.get(id);

    if (token) {
      this.tokens.set(id, { ...token, replacedById, revokedAt: rotatedAt });
    }
  }

  async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    for (const [id, token] of this.tokens) {
      if (token.familyId === familyId && token.revokedAt === null) {
        this.tokens.set(id, { ...token, revokedAt });
      }
    }
  }

  async deleteExpired(now: Date): Promise<number> {
    let deleted = 0;

    for (const [id, token] of this.tokens) {
      if (token.expiresAt.getTime() <= now.getTime()) {
        this.tokens.delete(id);
        deleted += 1;
      }
    }

    return deleted;
  }
}

/** Password "hashing" that is reversible on purpose, so tests stay fast. */
export class FakePasswordHasher extends PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return `hashed:${plainPassword}`;
  }

  async verify(hash: string, plainPassword: string): Promise<boolean> {
    return hash === `hashed:${plainPassword}`;
  }
}

export class FakeAccessTokenService extends AccessTokenService {
  readonly issued: AccessTokenClaims[] = [];

  get expiresInSeconds(): number {
    return 900;
  }

  async issue(claims: AccessTokenClaims): Promise<string> {
    this.issued.push(claims);

    return `access:${claims.sub}:${claims.tid}:${claims.mid}`;
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    const [prefix, sub, tid, mid] = token.split(':');

    return prefix === 'access' && sub && tid && mid ? { sub, tid, mid } : null;
  }
}

export class FakeSecureTokenFactory extends SecureTokenFactory {
  private counter = 0;

  create(): GeneratedToken {
    this.counter += 1;
    const value = `refresh-${this.counter}`;

    return { value, hash: this.hash(value) };
  }

  hash(value: string): string {
    return `hash:${value}`;
  }
}

export class FixedClock extends Clock {
  constructor(private current: Date) {
    super();
  }

  now(): Date {
    return this.current;
  }

  advanceDays(days: number): void {
    this.current = new Date(
      this.current.getTime() + days * 24 * 60 * 60 * 1000,
    );
  }
}

export class SequentialIdGenerator extends IdGenerator {
  private counter = 0;

  generate(): string {
    this.counter += 1;

    return `id-${String(this.counter).padStart(4, '0')}`;
  }
}

/** Runs the work without a database; commit semantics are covered by integration tests. */
export class ImmediateTransactionRunner extends TransactionRunner {
  calls = 0;

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.calls += 1;

    return work();
  }
}

export class FakeSessionPolicy extends SessionPolicy {
  constructor(private readonly ttlDays = 30) {
    super();
  }

  get refreshTokenTtlDays(): number {
    return this.ttlDays;
  }
}
