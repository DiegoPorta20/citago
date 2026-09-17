import type { DataSource } from 'typeorm';

import { MembershipStatus } from '../../modules/identity/domain/membership-status.js';
import { UserRole } from '../../shared/domain/user-role.js';
import { MembershipOrmEntity } from '../../modules/identity/infrastructure/persistence/typeorm/entities/membership.orm-entity.js';
import { UserOrmEntity } from '../../modules/identity/infrastructure/persistence/typeorm/entities/user.orm-entity.js';
import { Argon2PasswordHasher } from '../../modules/identity/infrastructure/security/argon2-password-hasher.js';
import { BusinessType } from '../../modules/tenants/domain/business-type.js';
import { TenantStatus } from '../../modules/tenants/domain/tenant-status.js';
import { TenantOrmEntity } from '../../modules/tenants/infrastructure/persistence/typeorm/entities/tenant.orm-entity.js';

/**
 * Development data. Obviously fake, and idempotent: running it twice leaves the
 * same rows, so it is safe to re-run after a migration.
 *
 * Identifiers are fixed (not random) so that fixtures, screenshots and manual
 * testing keep referring to the same records.
 */
export const DEMO_TENANT_ID = '01999999-0000-7000-8000-000000000001';

const DEMO_PASSWORD = 'Demo1234!';

interface DemoUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly membershipId: string;
}

const DEMO_USERS: readonly DemoUser[] = [
  {
    id: '01999999-0000-7000-8000-000000000011',
    email: 'owner@demo.local',
    name: 'Carlos Demo',
    role: UserRole.Owner,
    membershipId: '01999999-0000-7000-8000-000000000021',
  },
  {
    id: '01999999-0000-7000-8000-000000000012',
    email: 'admin@demo.local',
    name: 'Ana Demo',
    role: UserRole.Admin,
    membershipId: '01999999-0000-7000-8000-000000000022',
  },
  {
    id: '01999999-0000-7000-8000-000000000013',
    email: 'staff@demo.local',
    name: 'Luis Demo',
    role: UserRole.Staff,
    membershipId: '01999999-0000-7000-8000-000000000023',
  },
];

export interface SeedSummary {
  readonly tenantId: string;
  readonly users: readonly { email: string; role: UserRole }[];
  readonly password: string;
}

export async function runDevSeed(dataSource: DataSource): Promise<SeedSummary> {
  const hasher = new Argon2PasswordHasher();
  const passwordHash = await hasher.hash(DEMO_PASSWORD);

  await dataSource.transaction(async (manager) => {
    const now = new Date();

    await manager.getRepository(TenantOrmEntity).upsert(
      {
        id: DEMO_TENANT_ID,
        name: 'Barbería Demo',
        slug: 'barberia-demo',
        businessType: BusinessType.Barbershop,
        country: 'PE',
        currency: 'PEN',
        timezone: 'America/Lima',
        phone: '+51900000000',
        email: 'contacto@demo.local',
        status: TenantStatus.Active,
        createdAt: now,
        updatedAt: now,
      },
      ['id'],
    );

    for (const user of DEMO_USERS) {
      await manager.getRepository(UserOrmEntity).upsert(
        {
          id: user.id,
          email: user.email,
          passwordHash,
          name: user.name,
          createdAt: now,
          updatedAt: now,
        },
        ['id'],
      );

      await manager.getRepository(MembershipOrmEntity).upsert(
        {
          id: user.membershipId,
          tenantId: DEMO_TENANT_ID,
          userId: user.id,
          role: user.role,
          status: MembershipStatus.Active,
          createdAt: now,
          updatedAt: now,
        },
        ['id'],
      );
    }
  });

  return {
    tenantId: DEMO_TENANT_ID,
    users: DEMO_USERS.map(({ email, role }) => ({ email, role })),
    password: DEMO_PASSWORD,
  };
}
