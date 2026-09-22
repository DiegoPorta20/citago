import type { DataSource } from 'typeorm';
import { v7 as uuidV7 } from 'uuid';

import {
  createTestDataSource,
  truncateAll,
} from '../../../../../../test/support/test-data-source.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { UuidV7IdGenerator } from '../../../../../shared/infrastructure/uuid-v7-id-generator.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { BusinessType } from '../../../../tenants/domain/business-type.js';
import { Tenant } from '../../../../tenants/domain/tenant.entity.js';
import { TypeOrmTenantRepository } from '../../../../tenants/infrastructure/persistence/typeorm/typeorm-tenant.repository.js';
import { Client } from '../../../domain/client.entity.js';
import { ClientPhoneAlreadyRegisteredError } from '../../../domain/errors/clients.errors.js';
import { TypeOrmClientRepository } from './typeorm-client.repository.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const PHONE = PhoneNumber.create('999999999', 'PE');

describe('TypeOrmClientRepository (integration)', () => {
  let dataSource: DataSource;
  let clients: TypeOrmClientRepository;
  let tenants: TypeOrmTenantRepository;
  let tenantA: string;
  let tenantB: string;

  const createTenant = async (slug: string): Promise<string> => {
    const tenant = Tenant.create(
      {
        id: uuidV7(),
        name: slug,
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

  const newClient = (
    tenantId: string,
    name: string,
    phone: PhoneNumber | null = null,
  ): Client => Client.create({ id: uuidV7(), tenantId, name, phone }, NOW);

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    const context = new TransactionalEntityManager(dataSource);
    clients = new TypeOrmClientRepository(context);
    tenants = new TypeOrmTenantRepository(context, new UuidV7IdGenerator());
  }, 60_000);

  beforeEach(async () => {
    await truncateAll(dataSource);
    tenantA = await createTenant('clientes-a');
    tenantB = await createTenant('clientes-b');
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  describe('phone uniqueness (rule CL-2)', () => {
    it('rejects a second client with the same phone in the same tenant', async () => {
      await clients.save(newClient(tenantA, 'Juan', PHONE));

      await expect(
        clients.save(newClient(tenantA, 'Juan bis', PHONE)),
      ).rejects.toThrow(ClientPhoneAlreadyRegisteredError);
    });

    it('translates the race of two simultaneous creations into a 409, not a 500', async () => {
      // Both requests passed the use case check before either one committed.
      const results = await Promise.allSettled([
        clients.save(newClient(tenantA, 'Juan 1', PHONE)),
        clients.save(newClient(tenantA, 'Juan 2', PHONE)),
      ]);

      const rejected = results.filter((result) => result.status === 'rejected');

      expect(rejected).toHaveLength(1);
      // TypeScript infers the filter as a type guard, so rejected[0] is narrowed.
      expect(rejected[0].reason).toBeInstanceOf(
        ClientPhoneAlreadyRegisteredError,
      );
    });

    it('accepts any number of clients without a phone', async () => {
      await clients.save(newClient(tenantA, 'Walk-in 1'));
      await clients.save(newClient(tenantA, 'Walk-in 2'));
      await clients.save(newClient(tenantA, 'Walk-in 3'));

      const page = await clients.list(tenantA, {}, { page: 1, limit: 20 });

      expect(page.meta.total).toBe(3);
    });

    it('accepts the same phone in two tenants', async () => {
      await clients.save(newClient(tenantA, 'Juan', PHONE));

      await expect(
        clients.save(newClient(tenantB, 'Juan', PHONE)),
      ).resolves.toBeUndefined();
    });

    it('keeps the phone reserved by a deleted client', async () => {
      const deleted = newClient(tenantA, 'Juan', PHONE);
      deleted.softDelete(NOW);
      await clients.save(deleted);

      // Still found by phone, so the use case can offer to restore it.
      const found = await clients.findByPhone(tenantA, PHONE);
      expect(found?.id).toBe(deleted.id);
      expect(found?.isDeleted).toBe(true);
    });
  });

  describe('tenant scoping and soft delete', () => {
    it('does not find a client from another tenant', async () => {
      const client = newClient(tenantA, 'Juan', PHONE);
      await clients.save(client);

      await expect(
        clients.findByIdForTenant(client.id, tenantB),
      ).resolves.toBeNull();
      await expect(clients.findByPhone(tenantB, PHONE)).resolves.toBeNull();
    });

    it('hides a deleted client unless the restore flow asks for it', async () => {
      const client = newClient(tenantA, 'Juan');
      client.softDelete(NOW);
      await clients.save(client);

      await expect(
        clients.findByIdForTenant(client.id, tenantA),
      ).resolves.toBeNull();
      await expect(
        clients.findByIdForTenant(client.id, tenantA, { includeDeleted: true }),
      ).resolves.not.toBeNull();
    });

    it('never lists deleted clients', async () => {
      const deleted = newClient(tenantA, 'Borrado');
      deleted.softDelete(NOW);
      await clients.save(deleted);
      await clients.save(newClient(tenantA, 'Activo'));

      const page = await clients.list(tenantA, {}, { page: 1, limit: 20 });

      expect(page.items.map((client) => client.name)).toEqual(['Activo']);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await clients.save(
        newClient(tenantA, 'Ana Torres', PhoneNumber.create('988888888', 'PE')),
      );
      await clients.save(newClient(tenantA, 'Juan Pérez', PHONE));
      await clients.save(newClient(tenantA, 'Juana Ríos'));
      await clients.save(newClient(tenantB, 'Juan Ajeno'));
    });

    it('finds by name prefix within the tenant', async () => {
      const page = await clients.list(
        tenantA,
        { query: 'Juan' },
        { page: 1, limit: 20 },
      );

      expect(page.items.map((client) => client.name)).toEqual([
        'Juan Pérez',
        'Juana Ríos',
      ]);
    });

    it('finds by phone digits typed with spaces', async () => {
      const page = await clients.list(
        tenantA,
        { query: '999 999' },
        { page: 1, limit: 20 },
      );

      expect(page.items.map((client) => client.name)).toEqual(['Juan Pérez']);
    });

    it('matches names regardless of accents and case, thanks to the collation', async () => {
      const page = await clients.list(
        tenantA,
        { query: 'juana rios' },
        { page: 1, limit: 20 },
      );

      expect(page.items.map((client) => client.name)).toEqual(['Juana Ríos']);
    });

    it('paginates with a stable order', async () => {
      const first = await clients.list(tenantA, {}, { page: 1, limit: 2 });
      const second = await clients.list(tenantA, {}, { page: 2, limit: 2 });

      expect(first.meta.total).toBe(3);
      expect(
        [...first.items, ...second.items].map((client) => client.name),
      ).toEqual(['Ana Torres', 'Juan Pérez', 'Juana Ríos']);
    });
  });
});
