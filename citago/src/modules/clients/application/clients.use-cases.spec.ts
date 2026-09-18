import {
  FixedClock,
  InMemoryTenantRepository,
  SequentialIdGenerator,
} from '../../../../test/support/fakes/identity.fakes.js';
import { InMemoryClientRepository } from '../../../../test/support/fakes/clients.fakes.js';
import type { AuthContext } from '../../../shared/application/auth-context.js';
import { InvalidEmailError } from '../../../shared/domain/email.js';
import { InvalidPhoneNumberError } from '../../../shared/domain/phone-number.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { BusinessType } from '../../tenants/domain/business-type.js';
import { Tenant } from '../../tenants/domain/tenant.entity.js';
import {
  ClientDeletedWithSamePhoneError,
  ClientNotFoundError,
  ClientPhoneAlreadyRegisteredError,
} from '../domain/errors/clients.errors.js';
import { ClientPhoneNormalizer } from './client-phone-normalizer.js';
import { CreateClientUseCase } from './create-client/create-client.use-case.js';
import { DeleteClientUseCase } from './delete-client/delete-client.use-case.js';
import { GetClientUseCase } from './get-client/get-client.use-case.js';
import { ListClientsUseCase } from './list-clients/list-clients.use-case.js';
import { RestoreClientUseCase } from './restore-client/restore-client.use-case.js';
import { UpdateClientUseCase } from './update-client/update-client.use-case.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');

const actor = (tenantId: string): AuthContext => ({
  userId: `user-${tenantId}`,
  tenantId,
  membershipId: `membership-${tenantId}`,
  role: UserRole.Owner,
});

const peru = actor('tenant-pe');
const argentina = actor('tenant-ar');
const otherPeru = actor('tenant-pe-2');

describe('Clients use cases', () => {
  let clients: InMemoryClientRepository;
  let create: CreateClientUseCase;
  let update: UpdateClientUseCase;
  let get: GetClientUseCase;
  let list: ListClientsUseCase;
  let remove: DeleteClientUseCase;
  let restore: RestoreClientUseCase;

  beforeEach(async () => {
    clients = new InMemoryClientRepository();
    const tenants = new InMemoryTenantRepository();

    for (const [id, country, timezone] of [
      ['tenant-pe', 'PE', 'America/Lima'],
      ['tenant-ar', 'AR', 'America/Argentina/Buenos_Aires'],
      ['tenant-pe-2', 'PE', 'America/Lima'],
    ]) {
      await tenants.save(
        Tenant.create(
          {
            id,
            name: id,
            slug: id,
            businessType: BusinessType.Barbershop,
            country,
            currency: 'PEN',
            timezone,
          },
          NOW,
        ),
      );
    }

    const clock = new FixedClock(NOW);
    const normalizer = new ClientPhoneNormalizer(tenants);

    create = new CreateClientUseCase(
      clients,
      normalizer,
      new SequentialIdGenerator(),
      clock,
    );
    update = new UpdateClientUseCase(clients, normalizer, clock);
    get = new GetClientUseCase(clients);
    list = new ListClientsUseCase(clients);
    remove = new DeleteClientUseCase(clients, clock);
    restore = new RestoreClientUseCase(clients, clock);
  });

  describe('CreateClient', () => {
    it('normalizes a local number with the tenant country', async () => {
      const client = await create.execute(peru, {
        name: 'Juan',
        phone: '999 999 999',
      });

      expect(client.phone?.value).toBe('+51999999999');
    });

    it('uses each tenant own country as the default region', async () => {
      const client = await create.execute(argentina, {
        name: 'Martín',
        phone: '11 2345-6789',
      });

      expect(client.phone?.value).toBe('+541123456789');
    });

    it('detects a duplicate typed in another format (rule CL-1)', async () => {
      const first = await create.execute(peru, {
        name: 'Juan',
        phone: '999999999',
      });

      const attempt = create.execute(peru, {
        name: 'Juan bis',
        phone: '+51 999-999-999',
      });

      await expect(attempt).rejects.toThrow(ClientPhoneAlreadyRegisteredError);
      await attempt.catch((error: ClientPhoneAlreadyRegisteredError) => {
        // The app can open the existing client instead of guessing.
        expect(error.details).toEqual({ clientId: first.id });
      });
    });

    it('offers to restore a deleted client instead of duplicating it (F4)', async () => {
      const deleted = await create.execute(peru, {
        name: 'Juan',
        phone: '999999999',
      });
      await remove.execute(peru, deleted.id);

      const attempt = create.execute(peru, {
        name: 'Juan',
        phone: '999999999',
      });

      await expect(attempt).rejects.toThrow(ClientDeletedWithSamePhoneError);
      await attempt.catch((error: ClientDeletedWithSamePhoneError) => {
        expect(error.details).toEqual({
          clientId: deleted.id,
          restorable: true,
        });
      });
    });

    it('allows several clients without a phone', async () => {
      await create.execute(peru, { name: 'Walk-in 1' });
      await create.execute(peru, { name: 'Walk-in 2' });

      const page = await list.execute(peru, { page: 1, limit: 20 });

      expect(page.meta.total).toBe(2);
    });

    it('allows the same phone in two different businesses', async () => {
      await create.execute(peru, { name: 'Juan', phone: '999999999' });

      await expect(
        create.execute(otherPeru, { name: 'Juan', phone: '999999999' }),
      ).resolves.toMatchObject({ tenantId: 'tenant-pe-2' });
    });

    it('rejects an invalid phone or email', async () => {
      await expect(
        create.execute(peru, { name: 'X', phone: '123' }),
      ).rejects.toThrow(InvalidPhoneNumberError);
      await expect(
        create.execute(peru, { name: 'X', email: 'not-an-email' }),
      ).rejects.toThrow(InvalidEmailError);
    });
  });

  describe('UpdateClient', () => {
    it('keeps its own phone without reporting a clash', async () => {
      const client = await create.execute(peru, {
        name: 'Juan',
        phone: '999999999',
      });

      await expect(
        update.execute(peru, {
          clientId: client.id,
          name: 'Juan Pérez',
          phone: '+51 999 999 999',
        }),
      ).resolves.toMatchObject({ name: 'Juan Pérez' });
    });

    it('rejects taking the phone of another client', async () => {
      await create.execute(peru, { name: 'Juan', phone: '999999999' });
      const ana = await create.execute(peru, {
        name: 'Ana',
        phone: '988888888',
      });

      await expect(
        update.execute(peru, { clientId: ana.id, phone: '999 999 999' }),
      ).rejects.toThrow(ClientPhoneAlreadyRegisteredError);
    });

    it('clears the phone and email with an empty string', async () => {
      const client = await create.execute(peru, {
        name: 'Juan',
        phone: '999999999',
        email: 'juan@correo.pe',
      });

      const updated = await update.execute(peru, {
        clientId: client.id,
        phone: '',
        email: '',
      });

      expect(updated.phone).toBeNull();
      expect(updated.email).toBeNull();
    });

    it('cannot touch a client of another tenant', async () => {
      const client = await create.execute(peru, { name: 'Juan' });

      await expect(
        update.execute(otherPeru, { clientId: client.id, name: 'Hacked' }),
      ).rejects.toThrow(ClientNotFoundError);
    });

    it('cannot edit a deleted client', async () => {
      const client = await create.execute(peru, { name: 'Juan' });
      await remove.execute(peru, client.id);

      await expect(
        update.execute(peru, { clientId: client.id, name: 'Otro' }),
      ).rejects.toThrow(ClientNotFoundError);
    });
  });

  describe('delete and restore', () => {
    it('hides a deleted client from reads and lists', async () => {
      const client = await create.execute(peru, { name: 'Juan' });

      await remove.execute(peru, client.id);

      await expect(get.execute(peru, client.id)).rejects.toThrow(
        ClientNotFoundError,
      );
      await expect(
        list.execute(peru, { page: 1, limit: 20 }),
      ).resolves.toMatchObject({ meta: { total: 0 } });
    });

    it('brings the client back', async () => {
      const client = await create.execute(peru, {
        name: 'Juan',
        phone: '999999999',
      });
      await remove.execute(peru, client.id);

      const restored = await restore.execute(peru, client.id);

      expect(restored.isDeleted).toBe(false);
      await expect(get.execute(peru, client.id)).resolves.toMatchObject({
        id: client.id,
      });
    });

    it('restoring an active client is a harmless no-op', async () => {
      const client = await create.execute(peru, { name: 'Juan' });

      await expect(restore.execute(peru, client.id)).resolves.toMatchObject({
        isDeleted: false,
      });
    });

    it('cannot delete or restore a client of another tenant', async () => {
      const client = await create.execute(peru, { name: 'Juan' });

      await expect(remove.execute(otherPeru, client.id)).rejects.toThrow(
        ClientNotFoundError,
      );
      await expect(restore.execute(otherPeru, client.id)).rejects.toThrow(
        ClientNotFoundError,
      );
    });
  });

  describe('ListClients', () => {
    beforeEach(async () => {
      await create.execute(peru, { name: 'Ana Torres', phone: '988888888' });
      await create.execute(peru, { name: 'Juan Pérez', phone: '999999999' });
      await create.execute(peru, { name: 'Juana Ríos' });
      await create.execute(otherPeru, { name: 'Juan de otro negocio' });
    });

    it('lists only the caller tenant clients, sorted by name', async () => {
      const page = await list.execute(peru, { page: 1, limit: 20 });

      expect(page.items.map((client) => client.name)).toEqual([
        'Ana Torres',
        'Juan Pérez',
        'Juana Ríos',
      ]);
    });

    it('searches by name prefix', async () => {
      const page = await list.execute(peru, {
        page: 1,
        limit: 20,
        query: 'Juan',
      });

      expect(page.meta.total).toBe(2);
    });

    it('searches by phone digits, however they were typed', async () => {
      const page = await list.execute(peru, {
        page: 1,
        limit: 20,
        query: '999 999',
      });

      expect(page.items.map((client) => client.name)).toEqual(['Juan Pérez']);
    });
  });
});
