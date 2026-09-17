import type { DataSource } from 'typeorm';
import { v7 as uuidV7 } from 'uuid';

import {
  createTestDataSource,
  truncateAll,
} from '../../../../../../test/support/test-data-source.js';
import { Email } from '../../../../../shared/domain/email.js';
import { UserRole } from '../../../../../shared/domain/user-role.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { TypeOrmTransactionRunner } from '../../../../../shared/infrastructure/persistence/typeorm-transaction-runner.js';
import { BusinessType } from '../../../../tenants/domain/business-type.js';
import { Tenant } from '../../../../tenants/domain/tenant.entity.js';
import { TypeOrmTenantRepository } from '../../../../tenants/infrastructure/persistence/typeorm/typeorm-tenant.repository.js';
import { Membership } from '../../../domain/membership.entity.js';
import { User } from '../../../domain/user.entity.js';
import { TypeOrmMembershipRepository } from './typeorm-membership.repository.js';
import { TypeOrmRefreshTokenRepository } from './typeorm-refresh-token.repository.js';
import { TypeOrmUserRepository } from './typeorm-user.repository.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');

describe('Identity repositories (integration)', () => {
  let dataSource: DataSource;
  let context: TransactionalEntityManager;
  let transaction: TypeOrmTransactionRunner;
  let tenants: TypeOrmTenantRepository;
  let users: TypeOrmUserRepository;
  let memberships: TypeOrmMembershipRepository;
  let refreshTokens: TypeOrmRefreshTokenRepository;

  const createTenant = async (slug: string): Promise<Tenant> => {
    const tenant = Tenant.create(
      {
        id: uuidV7(),
        name: `Barbería ${slug}`,
        slug,
        businessType: BusinessType.Barbershop,
        country: 'PE',
        currency: 'PEN',
        timezone: 'America/Lima',
      },
      NOW,
    );

    await tenants.save(tenant);

    return tenant;
  };

  const createUser = async (email: string): Promise<User> => {
    const user = User.create(
      {
        id: uuidV7(),
        email: Email.create(email),
        passwordHash: 'hash',
        name: 'Test User',
      },
      NOW,
    );

    await users.save(user);

    return user;
  };

  const createMembership = async (
    tenantId: string,
    userId: string,
    role = UserRole.Owner,
  ): Promise<Membership> => {
    const membership = Membership.create(
      { id: uuidV7(), tenantId, userId, role },
      NOW,
    );

    await memberships.save(membership);

    return membership;
  };

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    context = new TransactionalEntityManager(dataSource);
    transaction = new TypeOrmTransactionRunner(dataSource, context);
    tenants = new TypeOrmTenantRepository(context);
    users = new TypeOrmUserRepository(context);
    memberships = new TypeOrmMembershipRepository(context);
    refreshTokens = new TypeOrmRefreshTokenRepository(context);
  }, 60_000);

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  describe('users', () => {
    it('round-trips a user through the domain entity', async () => {
      const user = await createUser('carlos@barberia.pe');
      const found = await users.findById(user.id);

      expect(found?.email.value).toBe('carlos@barberia.pe');
      expect(found?.name).toBe('Test User');
      expect(found?.createdAt).toEqual(NOW);
    });

    it('finds a user by email regardless of the case typed at login', async () => {
      await createUser('carlos@barberia.pe');

      const found = await users.findByEmail(Email.create('CARLOS@Barberia.PE'));

      expect(found).not.toBeNull();
    });

    it('reports an unknown email as not existing', async () => {
      await expect(
        users.existsByEmail(Email.create('nadie@barberia.pe')),
      ).resolves.toBe(false);
    });
  });

  describe('memberships and tenant scoping', () => {
    it('finds a membership within its own tenant', async () => {
      const tenant = await createTenant('barberia-a');
      const user = await createUser('a@barberia.pe');
      const membership = await createMembership(tenant.id, user.id);

      const found = await memberships.findByIdForTenant(
        membership.id,
        tenant.id,
      );

      expect(found?.role).toBe(UserRole.Owner);
    });

    it('does not find it from another tenant, even with the right id', async () => {
      const tenantA = await createTenant('barberia-a');
      const tenantB = await createTenant('barberia-b');
      const user = await createUser('a@barberia.pe');
      const membership = await createMembership(tenantA.id, user.id);

      // This is the IDOR attempt: a valid id used from the wrong tenant.
      await expect(
        memberships.findByIdForTenant(membership.id, tenantB.id),
      ).resolves.toBeNull();
    });

    it('counts active owners per tenant, not across the platform', async () => {
      const tenantA = await createTenant('barberia-a');
      const tenantB = await createTenant('barberia-b');
      const userA = await createUser('a@barberia.pe');
      const userB = await createUser('b@barberia.pe');

      await createMembership(tenantA.id, userA.id, UserRole.Owner);
      await createMembership(tenantB.id, userB.id, UserRole.Owner);

      await expect(
        memberships.countActiveByRole(tenantA.id, UserRole.Owner),
      ).resolves.toBe(1);
    });

    it('excludes deactivated memberships from the active list', async () => {
      const tenant = await createTenant('barberia-a');
      const user = await createUser('a@barberia.pe');
      const membership = await createMembership(tenant.id, user.id);

      membership.deactivate(NOW);
      await memberships.save(membership);

      await expect(memberships.findActiveByUserId(user.id)).resolves.toEqual(
        [],
      );
    });

    it('returns a user memberships oldest first, for the login path', async () => {
      const older = await createTenant('barberia-antigua');
      const newer = await createTenant('barberia-nueva');
      const user = await createUser('a@barberia.pe');

      await memberships.save(
        Membership.create(
          {
            id: uuidV7(),
            tenantId: newer.id,
            userId: user.id,
            role: UserRole.Staff,
          },
          new Date('2026-06-01T12:00:00.000Z'),
        ),
      );
      await memberships.save(
        Membership.create(
          {
            id: uuidV7(),
            tenantId: older.id,
            userId: user.id,
            role: UserRole.Owner,
          },
          new Date('2026-01-01T12:00:00.000Z'),
        ),
      );

      const found = await memberships.findActiveByUserId(user.id);

      expect(found.map((membership) => membership.tenantId)).toEqual([
        older.id,
        newer.id,
      ]);
    });
  });

  describe('refresh tokens', () => {
    const insertToken = async (
      tenantId: string,
      userId: string,
      membershipId: string,
      overrides: { hash?: string; familyId?: string } = {},
    ) => {
      const id = uuidV7();

      await refreshTokens.insert({
        id,
        userId,
        tenantId,
        membershipId,
        tokenHash: overrides.hash ?? `hash-${id}`,
        familyId: overrides.familyId ?? uuidV7(),
        expiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
        createdAt: NOW,
      });

      return id;
    };

    it('stores and resolves a token by its hash, carrying its tenant', async () => {
      const tenant = await createTenant('barberia-a');
      const user = await createUser('a@barberia.pe');
      const membership = await createMembership(tenant.id, user.id);

      const id = await insertToken(tenant.id, user.id, membership.id, {
        hash: 'a'.repeat(64),
      });

      const found = await refreshTokens.findByHash('a'.repeat(64));

      expect(found?.id).toBe(id);
      expect(found?.tenantId).toBe(tenant.id);
      expect(found?.revokedAt).toBeNull();
    });

    it('rejects a duplicate hash at the database level', async () => {
      const tenant = await createTenant('barberia-a');
      const user = await createUser('a@barberia.pe');
      const membership = await createMembership(tenant.id, user.id);

      await insertToken(tenant.id, user.id, membership.id, {
        hash: 'b'.repeat(64),
      });

      await expect(
        insertToken(tenant.id, user.id, membership.id, {
          hash: 'b'.repeat(64),
        }),
      ).rejects.toThrow(/Duplicate entry/);
    });

    it('revokes an entire family in one statement', async () => {
      const tenant = await createTenant('barberia-a');
      const user = await createUser('a@barberia.pe');
      const membership = await createMembership(tenant.id, user.id);
      const familyId = uuidV7();

      const first = await insertToken(tenant.id, user.id, membership.id, {
        hash: 'c'.repeat(64),
        familyId,
      });
      await insertToken(tenant.id, user.id, membership.id, {
        hash: 'd'.repeat(64),
        familyId,
      });
      await insertToken(tenant.id, user.id, membership.id, {
        hash: 'e'.repeat(64),
      });

      await refreshTokens.revokeFamily(familyId, NOW);

      expect(
        (await refreshTokens.findByHash('c'.repeat(64)))?.revokedAt,
      ).toEqual(NOW);
      expect(
        (await refreshTokens.findByHash('d'.repeat(64)))?.revokedAt,
      ).toEqual(NOW);
      // A token of another family is untouched.
      expect(
        (await refreshTokens.findByHash('e'.repeat(64)))?.revokedAt,
      ).toBeNull();
      expect(first).toBeDefined();
    });

    it('keeps the original revocation time when a family is revoked twice', async () => {
      const tenant = await createTenant('barberia-a');
      const user = await createUser('a@barberia.pe');
      const membership = await createMembership(tenant.id, user.id);
      const familyId = uuidV7();

      await insertToken(tenant.id, user.id, membership.id, {
        hash: 'f'.repeat(64),
        familyId,
      });

      await refreshTokens.revokeFamily(familyId, NOW);
      await refreshTokens.revokeFamily(
        familyId,
        new Date('2026-12-31T00:00:00.000Z'),
      );

      expect(
        (await refreshTokens.findByHash('f'.repeat(64)))?.revokedAt,
      ).toEqual(NOW);
    });

    it('deletes only expired tokens', async () => {
      const tenant = await createTenant('barberia-a');
      const user = await createUser('a@barberia.pe');
      const membership = await createMembership(tenant.id, user.id);

      await refreshTokens.insert({
        id: uuidV7(),
        userId: user.id,
        tenantId: tenant.id,
        membershipId: membership.id,
        tokenHash: 'g'.repeat(64),
        familyId: uuidV7(),
        expiresAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: NOW,
      });
      await insertToken(tenant.id, user.id, membership.id, {
        hash: 'h'.repeat(64),
      });

      await expect(refreshTokens.deleteExpired(NOW)).resolves.toBe(1);
      await expect(
        refreshTokens.findByHash('h'.repeat(64)),
      ).resolves.not.toBeNull();
    });
  });

  describe('transactions', () => {
    it('commits every write of a successful unit of work', async () => {
      const result = await transaction.run(async () => {
        const tenant = await createTenant('barberia-tx-ok');
        const user = await createUser('tx-ok@barberia.pe');
        await createMembership(tenant.id, user.id);

        return { tenantId: tenant.id, userId: user.id };
      });

      await expect(tenants.findById(result.tenantId)).resolves.not.toBeNull();
      await expect(users.findById(result.userId)).resolves.not.toBeNull();
    });

    it('rolls back everything when the unit of work fails', async () => {
      const email = 'tx-fail@barberia.pe';

      await expect(
        transaction.run(async () => {
          const tenant = await createTenant('barberia-tx-fail');
          const user = await createUser(email);
          await createMembership(tenant.id, user.id);

          throw new Error('business rule rejected this');
        }),
      ).rejects.toThrow('business rule rejected this');

      // This is what makes sign-up safe: no orphan account, no orphan tenant.
      await expect(users.existsByEmail(Email.create(email))).resolves.toBe(
        false,
      );
      await expect(tenants.existsBySlug('barberia-tx-fail')).resolves.toBe(
        false,
      );
    });

    it('joins the outer transaction instead of opening a nested one', async () => {
      await expect(
        transaction.run(async () => {
          const tenant = await createTenant('barberia-nested');

          await transaction.run(async () => {
            const user = await createUser('nested@barberia.pe');
            await createMembership(tenant.id, user.id);
          });

          throw new Error('outer failure');
        }),
      ).rejects.toThrow('outer failure');

      // The inner work rolled back with the outer one: it was never committed
      // independently.
      await expect(
        users.existsByEmail(Email.create('nested@barberia.pe')),
      ).resolves.toBe(false);
    });
  });
});
