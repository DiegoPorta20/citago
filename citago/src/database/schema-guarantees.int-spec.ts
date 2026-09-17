import type { DataSource } from 'typeorm';
import { v7 as uuidV7 } from 'uuid';

import {
  createTestDataSource,
  queryRows,
  truncateAll,
} from '../../test/support/test-data-source.js';
import { MembershipStatus } from '../modules/identity/domain/membership-status.js';
import { UserRole } from '../shared/domain/user-role.js';
import { MembershipOrmEntity } from '../modules/identity/infrastructure/persistence/typeorm/entities/membership.orm-entity.js';
import { UserOrmEntity } from '../modules/identity/infrastructure/persistence/typeorm/entities/user.orm-entity.js';
import { BusinessType } from '../modules/tenants/domain/business-type.js';
import { TenantStatus } from '../modules/tenants/domain/tenant-status.js';
import { TenantOrmEntity } from '../modules/tenants/infrastructure/persistence/typeorm/entities/tenant.orm-entity.js';

/**
 * Guarantees the database itself must provide, independently of application
 * code. These are the promises the rest of the architecture is built on.
 */
describe('Schema guarantees (integration)', () => {
  let dataSource: DataSource;

  const insertTenant = async (slug: string): Promise<string> => {
    const id = uuidV7();
    const now = new Date();

    await dataSource.getRepository(TenantOrmEntity).insert({
      id,
      name: `Tenant ${slug}`,
      slug,
      businessType: BusinessType.Barbershop,
      country: 'PE',
      currency: 'PEN',
      timezone: 'America/Lima',
      phone: null,
      email: null,
      status: TenantStatus.Active,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  };

  const insertUser = async (email: string): Promise<string> => {
    const id = uuidV7();
    const now = new Date();

    await dataSource.getRepository(UserOrmEntity).insert({
      id,
      email,
      passwordHash: 'not-a-real-hash',
      name: 'Test User',
      createdAt: now,
      updatedAt: now,
    });

    return id;
  };

  const insertMembership = async (
    tenantId: string,
    userId: string,
  ): Promise<void> => {
    const now = new Date();

    await dataSource.getRepository(MembershipOrmEntity).insert({
      id: uuidV7(),
      tenantId,
      userId,
      role: UserRole.Owner,
      status: MembershipStatus.Active,
      createdAt: now,
      updatedAt: now,
    });
  };

  beforeAll(async () => {
    dataSource = await createTestDataSource();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  describe('migrations', () => {
    it('applies from an empty database and leaves no pending changes', async () => {
      // `runMigrations` already ran in createTestDataSource; if the entities
      // and the migration disagreed, this would report work to do.
      await expect(dataSource.showMigrations()).resolves.toBe(false);
    });

    it('creates every table as InnoDB with utf8mb4', async () => {
      const rows = await queryRows<{
        name: string;
        engine: string;
        collation: string;
      }>(
        dataSource,
        `SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_COLLATION AS collation
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> 'migrations'`,
      );

      expect(rows).not.toHaveLength(0);

      for (const row of rows) {
        expect(row.engine).toBe('InnoDB');
        expect(row.collation).toMatch(/^utf8mb4/);
      }
    });
  });

  describe('identity constraints', () => {
    it('rejects two users with the same email', async () => {
      await insertUser('duplicate@demo.local');

      await expect(insertUser('duplicate@demo.local')).rejects.toThrow(
        /Duplicate entry/,
      );
    });

    it('rejects the same user twice in the same tenant', async () => {
      const tenantId = await insertTenant('tenant-a');
      const userId = await insertUser('one@demo.local');

      await insertMembership(tenantId, userId);

      await expect(insertMembership(tenantId, userId)).rejects.toThrow(
        /Duplicate entry/,
      );
    });

    it('allows the same user in two different tenants', async () => {
      const tenantA = await insertTenant('tenant-a');
      const tenantB = await insertTenant('tenant-b');
      const userId = await insertUser('shared@demo.local');

      await insertMembership(tenantA, userId);
      await insertMembership(tenantB, userId);

      await expect(
        dataSource
          .getRepository(MembershipOrmEntity)
          .count({ where: { userId } }),
      ).resolves.toBe(2);
    });

    it('rejects a membership pointing at a tenant that does not exist', async () => {
      const userId = await insertUser('orphan@demo.local');

      await expect(insertMembership(uuidV7(), userId)).rejects.toThrow(
        /foreign key constraint fails/i,
      );
    });

    it('refuses to delete a tenant that still has memberships', async () => {
      const tenantId = await insertTenant('tenant-a');
      const userId = await insertUser('kept@demo.local');
      await insertMembership(tenantId, userId);

      // ON DELETE RESTRICT: history is never destroyed by a stray delete.
      await expect(
        dataSource.query('DELETE FROM `tenants` WHERE `id` = ?', [tenantId]),
      ).rejects.toThrow(/foreign key constraint fails/i);
    });

    it('removes refresh tokens when the user is deleted (CASCADE inside the aggregate)', async () => {
      const tenantId = await insertTenant('tenant-a');
      const userId = await insertUser('sessions@demo.local');
      await insertMembership(tenantId, userId);

      const membership = await dataSource
        .getRepository(MembershipOrmEntity)
        .findOneByOrFail({ userId });

      await dataSource.query(
        `INSERT INTO refresh_tokens
           (id, user_id, tenant_id, membership_id, token_hash, family_id, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidV7(),
          userId,
          tenantId,
          membership.id,
          'a'.repeat(64),
          uuidV7(),
          new Date(),
          new Date(),
        ],
      );

      await dataSource.query('DELETE FROM `memberships` WHERE `id` = ?', [
        membership.id,
      ]);

      const remaining = await queryRows<{ total: number }>(
        dataSource,
        'SELECT COUNT(*) AS total FROM refresh_tokens',
      );

      expect(Number(remaining[0].total)).toBe(0);
    });
  });

  describe('UTC round trip', () => {
    it('reads back the exact instant it stored', async () => {
      const instant = new Date('2026-03-15T23:30:45.123Z');
      const id = uuidV7();

      await dataSource.getRepository(UserOrmEntity).insert({
        id,
        email: 'utc@demo.local',
        passwordHash: 'not-a-real-hash',
        name: 'UTC User',
        createdAt: instant,
        updatedAt: instant,
      });

      const stored = await dataSource
        .getRepository(UserOrmEntity)
        .findOneByOrFail({ id });

      // Fails loudly if the driver ever drifts to local time.
      expect(stored.createdAt.toISOString()).toBe(instant.toISOString());

      const raw = await queryRows<{ value: string }>(
        dataSource,
        'SELECT DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%s.%f") AS value FROM users WHERE id = ?',
        [id],
      );

      expect(raw[0].value).toBe('2026-03-15T23:30:45.123000');
    });
  });

  describe('composite tenant foreign keys (ADR 0004, layer 4)', () => {
    // Validated on disposable tables: the real pair of tables arrives with
    // clients and appointments. What is being proven here is the MySQL
    // guarantee the strategy depends on.
    beforeEach(async () => {
      await dataSource.query('DROP TABLE IF EXISTS `spike_children`');
      await dataSource.query('DROP TABLE IF EXISTS `spike_parents`');
      await dataSource.query(`
        CREATE TABLE \`spike_parents\` (
          \`id\` CHAR(36) NOT NULL,
          \`tenant_id\` CHAR(36) NOT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`uq_spike_parents_tenant_id\` (\`tenant_id\`, \`id\`)
        ) ENGINE=InnoDB
      `);
      await dataSource.query(`
        CREATE TABLE \`spike_children\` (
          \`id\` CHAR(36) NOT NULL,
          \`tenant_id\` CHAR(36) NOT NULL,
          \`parent_id\` CHAR(36) NOT NULL,
          PRIMARY KEY (\`id\`),
          CONSTRAINT \`fk_spike_children_parent\`
            FOREIGN KEY (\`tenant_id\`, \`parent_id\`)
            REFERENCES \`spike_parents\` (\`tenant_id\`, \`id\`)
            ON DELETE RESTRICT ON UPDATE RESTRICT
        ) ENGINE=InnoDB
      `);
    });

    afterAll(async () => {
      await dataSource.query('DROP TABLE IF EXISTS `spike_children`');
      await dataSource.query('DROP TABLE IF EXISTS `spike_parents`');
    });

    it('accepts a child that belongs to the same tenant as its parent', async () => {
      const tenantId = uuidV7();
      const parentId = uuidV7();

      await dataSource.query(
        'INSERT INTO spike_parents (id, tenant_id) VALUES (?, ?)',
        [parentId, tenantId],
      );

      await expect(
        dataSource.query(
          'INSERT INTO spike_children (id, tenant_id, parent_id) VALUES (?, ?, ?)',
          [uuidV7(), tenantId, parentId],
        ),
      ).resolves.toBeDefined();
    });

    it('rejects a child that references a parent of another tenant', async () => {
      const tenantA = uuidV7();
      const tenantB = uuidV7();
      const parentOfA = uuidV7();

      await dataSource.query(
        'INSERT INTO spike_parents (id, tenant_id) VALUES (?, ?)',
        [parentOfA, tenantA],
      );

      // This is the bug the fourth layer exists for: application code passing
      // a valid id from the wrong tenant. The database refuses it.
      await expect(
        dataSource.query(
          'INSERT INTO spike_children (id, tenant_id, parent_id) VALUES (?, ?, ?)',
          [uuidV7(), tenantB, parentOfA],
        ),
      ).rejects.toThrow(/foreign key constraint fails/i);
    });
  });
});
