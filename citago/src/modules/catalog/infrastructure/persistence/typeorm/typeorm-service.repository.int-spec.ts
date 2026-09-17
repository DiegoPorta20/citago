import type { DataSource } from 'typeorm';
import { v7 as uuidV7 } from 'uuid';

import {
  createTestDataSource,
  queryRows,
  truncateAll,
} from '../../../../../../test/support/test-data-source.js';
import { Money } from '../../../../../shared/domain/money.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { BusinessType } from '../../../../tenants/domain/business-type.js';
import { Tenant } from '../../../../tenants/domain/tenant.entity.js';
import { TypeOrmTenantRepository } from '../../../../tenants/infrastructure/persistence/typeorm/typeorm-tenant.repository.js';
import { Service } from '../../../domain/service.entity.js';
import { ServiceStatus } from '../../../domain/service-status.js';
import { TypeOrmServiceRepository } from './typeorm-service.repository.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');

describe('TypeOrmServiceRepository (integration)', () => {
  let dataSource: DataSource;
  let services: TypeOrmServiceRepository;
  let tenants: TypeOrmTenantRepository;
  let tenantA: string;
  let tenantB: string;

  const createTenant = async (slug: string): Promise<string> => {
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

    return tenant.id;
  };

  const addService = async (
    tenantId: string,
    name: string,
    price = '25.00',
    status = ServiceStatus.Active,
  ): Promise<Service> => {
    const service = Service.create(
      {
        id: uuidV7(),
        tenantId,
        name,
        durationMinutes: 30,
        price: Money.fromDecimalString(price),
      },
      NOW,
    );

    if (status === ServiceStatus.Inactive) {
      service.deactivate(NOW);
    }

    await services.save(service);

    return service;
  };

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    const context = new TransactionalEntityManager(dataSource);
    services = new TypeOrmServiceRepository(context);
    tenants = new TypeOrmTenantRepository(context);
  }, 60_000);

  beforeEach(async () => {
    await truncateAll(dataSource);
    tenantA = await createTenant('barberia-a');
    tenantB = await createTenant('barberia-b');
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  describe('money precision', () => {
    it.each(['0.05', '25.00', '35.50', '9999999999.99'])(
      'stores and reads %s without losing a cent',
      async (price) => {
        const service = await addService(tenantA, `Servicio ${price}`, price);

        const found = await services.findByIdForTenant(service.id, tenantA);

        expect(found?.price.toDecimalString()).toBe(price);
      },
    );

    it('keeps the raw column as a string, never a float', async () => {
      const service = await addService(tenantA, 'Corte', '0.07');

      const rows = await queryRows<{ price: string }>(
        dataSource,
        'SELECT price FROM services WHERE id = ?',
        [service.id],
      );

      expect(rows[0].price).toBe('0.07');
      expect(typeof rows[0].price).toBe('string');
    });

    it('rejects a negative price at the database level (rule CA-2)', async () => {
      // The CHECK constraint holds even for SQL written by hand.
      await expect(
        dataSource.query(
          `INSERT INTO services (id, tenant_id, name, duration_minutes, price, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
          [uuidV7(), tenantA, 'Negativo', 30, '-1.00', NOW, NOW],
        ),
      ).rejects.toThrow(/Check constraint/i);
    });

    it('rejects a zero duration at the database level (rule CA-1)', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO services (id, tenant_id, name, duration_minutes, price, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
          [uuidV7(), tenantA, 'Instantáneo', 0, '10.00', NOW, NOW],
        ),
      ).rejects.toThrow(/Check constraint/i);
    });
  });

  describe('tenant scoping', () => {
    it('finds a service in its own tenant', async () => {
      const service = await addService(tenantA, 'Corte');

      await expect(
        services.findByIdForTenant(service.id, tenantA),
      ).resolves.not.toBeNull();
    });

    it('does not find it from another tenant', async () => {
      const service = await addService(tenantA, 'Corte');

      await expect(
        services.findByIdForTenant(service.id, tenantB),
      ).resolves.toBeNull();
    });

    it('lists only the services of the given tenant', async () => {
      await addService(tenantA, 'Corte');
      await addService(tenantA, 'Barba');
      await addService(tenantB, 'Corte');

      const page = await services.list(tenantA, {}, { page: 1, limit: 20 });

      expect(page.meta.total).toBe(2);
      expect(page.items.every((service) => service.tenantId === tenantA)).toBe(
        true,
      );
    });

    it('scopes the duplicate-name check to the tenant', async () => {
      await addService(tenantA, 'Corte');

      await expect(
        services.existsActiveWithName(tenantB, 'Corte'),
      ).resolves.toBe(false);
    });
  });

  describe('duplicate name detection', () => {
    it('ignores case and accents, because the collation does', async () => {
      await addService(tenantA, 'Corte de Cabello');

      // utf8mb4_0900_ai_ci: accent-insensitive, case-insensitive.
      await expect(
        services.existsActiveWithName(tenantA, 'corte de cabello'),
      ).resolves.toBe(true);
      await expect(
        services.existsActiveWithName(tenantA, 'CORTE DE CABELLO'),
      ).resolves.toBe(true);
    });

    it('ignores inactive services', async () => {
      await addService(tenantA, 'Tinte', '60.00', ServiceStatus.Inactive);

      await expect(
        services.existsActiveWithName(tenantA, 'Tinte'),
      ).resolves.toBe(false);
    });

    it('can exclude the service being edited', async () => {
      const service = await addService(tenantA, 'Corte');

      await expect(
        services.existsActiveWithName(tenantA, 'Corte', service.id),
      ).resolves.toBe(false);
    });
  });

  describe('listing', () => {
    beforeEach(async () => {
      await addService(tenantA, 'Barba', '15.00');
      await addService(tenantA, 'Corte de cabello', '25.00');
      await addService(tenantA, 'Corte niño', '18.00');
      await addService(tenantA, 'Tinte', '60.00', ServiceStatus.Inactive);
    });

    it('orders by name', async () => {
      const page = await services.list(tenantA, {}, { page: 1, limit: 20 });

      expect(page.items.map((service) => service.name)).toEqual([
        'Barba',
        'Corte de cabello',
        'Corte niño',
        'Tinte',
      ]);
    });

    it('filters by status', async () => {
      const page = await services.list(
        tenantA,
        { status: ServiceStatus.Active },
        { page: 1, limit: 20 },
      );

      expect(page.meta.total).toBe(3);
    });

    it('searches by name prefix', async () => {
      const page = await services.list(
        tenantA,
        { query: 'Corte' },
        { page: 1, limit: 20 },
      );

      expect(page.meta.total).toBe(2);
    });

    it('paginates, reporting the full total', async () => {
      const page = await services.list(tenantA, {}, { page: 2, limit: 3 });

      expect(page.items).toHaveLength(1);
      expect(page.meta).toEqual({ page: 2, limit: 3, total: 4, totalPages: 2 });
    });
  });

  describe('composite key for later modules', () => {
    it('exposes UNIQUE(tenant_id, id), the target of appointment foreign keys', async () => {
      const indexes = await queryRows<{ INDEX_NAME: string }>(
        dataSource,
        `SELECT INDEX_NAME FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services'
           AND INDEX_NAME = 'uq_services_tenant_id'`,
      );

      expect(indexes).not.toHaveLength(0);
    });

    it('refuses to delete a tenant that still has services', async () => {
      await addService(tenantA, 'Corte');

      await expect(
        dataSource.query('DELETE FROM tenants WHERE id = ?', [tenantA]),
      ).rejects.toThrow(/foreign key constraint fails/i);
    });
  });
});
