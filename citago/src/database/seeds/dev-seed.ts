import type { DataSource } from 'typeorm';

import { ServiceStatus } from '../../modules/catalog/domain/service-status.js';
import { ServiceOrmEntity } from '../../modules/catalog/infrastructure/persistence/typeorm/entities/service.orm-entity.js';

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

interface DemoService {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number;
  readonly price: string;
  readonly status: ServiceStatus;
}

/** A plausible barbershop menu, in the tenant currency (PEN). */
const DEMO_SERVICES: readonly DemoService[] = [
  {
    id: '01999999-0000-7000-8000-000000000031',
    name: 'Corte de cabello',
    description: 'Incluye lavado y peinado',
    durationMinutes: 30,
    price: '25.00',
    status: ServiceStatus.Active,
  },
  {
    id: '01999999-0000-7000-8000-000000000032',
    name: 'Barba',
    description: 'Perfilado y afeitado con navaja',
    durationMinutes: 20,
    price: '15.00',
    status: ServiceStatus.Active,
  },
  {
    id: '01999999-0000-7000-8000-000000000033',
    name: 'Corte + barba',
    description: null,
    durationMinutes: 45,
    price: '35.00',
    status: ServiceStatus.Active,
  },
  {
    id: '01999999-0000-7000-8000-000000000034',
    name: 'Corte niño',
    description: 'Hasta 12 años',
    durationMinutes: 25,
    price: '18.00',
    status: ServiceStatus.Active,
  },
  {
    id: '01999999-0000-7000-8000-000000000035',
    name: 'Diseño de cejas',
    description: null,
    durationMinutes: 15,
    price: '10.00',
    status: ServiceStatus.Active,
  },
  {
    id: '01999999-0000-7000-8000-000000000036',
    name: 'Tinte',
    description: 'Fuera de carta por ahora',
    durationMinutes: 60,
    price: '60.00',
    status: ServiceStatus.Inactive,
  },
];

export interface SeedSummary {
  readonly tenantId: string;
  readonly users: readonly { email: string; role: UserRole }[];
  readonly password: string;
  readonly serviceCount: number;
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

    for (const service of DEMO_SERVICES) {
      await manager.getRepository(ServiceOrmEntity).upsert(
        {
          id: service.id,
          tenantId: DEMO_TENANT_ID,
          name: service.name,
          description: service.description,
          durationMinutes: service.durationMinutes,
          price: service.price,
          status: service.status,
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
    serviceCount: DEMO_SERVICES.length,
  };
}
