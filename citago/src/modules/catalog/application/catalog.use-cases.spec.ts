import {
  FixedClock,
  SequentialIdGenerator,
} from '../../../../test/support/fakes/identity.fakes.js';
import { InMemoryServiceRepository } from '../../../../test/support/fakes/catalog.fakes.js';
import type { AuthContext } from '../../../shared/application/auth-context.js';
import { InvalidMoneyError } from '../../../shared/domain/money.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import {
  DuplicateServiceNameError,
  ServiceNotFoundError,
} from '../domain/errors/catalog.errors.js';
import { ServiceStatus } from '../domain/service-status.js';
import { CreateServiceUseCase } from './create-service/create-service.use-case.js';
import { GetServiceUseCase } from './get-service/get-service.use-case.js';
import { ListServicesUseCase } from './list-services/list-services.use-case.js';
import { SetServiceStatusUseCase } from './set-service-status/set-service-status.use-case.js';
import { UpdateServiceUseCase } from './update-service/update-service.use-case.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');

const tenantA: AuthContext = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  membershipId: 'membership-a',
  role: UserRole.Owner,
};

const tenantB: AuthContext = {
  userId: 'user-b',
  tenantId: 'tenant-b',
  membershipId: 'membership-b',
  role: UserRole.Owner,
};

describe('Catalog use cases', () => {
  let services: InMemoryServiceRepository;
  let clock: FixedClock;
  let create: CreateServiceUseCase;
  let update: UpdateServiceUseCase;
  let setStatus: SetServiceStatusUseCase;
  let list: ListServicesUseCase;
  let get: GetServiceUseCase;

  beforeEach(() => {
    services = new InMemoryServiceRepository();
    clock = new FixedClock(NOW);

    create = new CreateServiceUseCase(
      services,
      new SequentialIdGenerator(),
      clock,
    );
    update = new UpdateServiceUseCase(services, clock);
    setStatus = new SetServiceStatusUseCase(services, clock);
    list = new ListServicesUseCase(services);
    get = new GetServiceUseCase(services);
  });

  const createHaircut = (actor: AuthContext = tenantA) =>
    create.execute(actor, {
      name: 'Corte de cabello',
      durationMinutes: 30,
      price: '25.00',
    });

  describe('CreateService', () => {
    it('creates a service in the tenant of the session', async () => {
      const service = await createHaircut();

      // The tenant comes from the AuthContext, never from the input.
      expect(service.tenantId).toBe('tenant-a');
      expect(service.status).toBe(ServiceStatus.Active);
      expect(service.price.toDecimalString()).toBe('25.00');
    });

    it('rejects a name already used by an active service, ignoring case', async () => {
      await createHaircut();

      await expect(
        create.execute(tenantA, {
          name: 'CORTE DE CABELLO',
          durationMinutes: 30,
          price: '25.00',
        }),
      ).rejects.toThrow(DuplicateServiceNameError);
    });

    it('allows reusing the name of a deactivated service', async () => {
      const original = await createHaircut();
      await setStatus.execute(tenantA, {
        serviceId: original.id,
        status: ServiceStatus.Inactive,
      });

      // The old service keeps its name for history; the catalogue can move on.
      await expect(createHaircut()).resolves.toMatchObject({
        name: 'Corte de cabello',
      });
    });

    it('allows the same name in a different business', async () => {
      await createHaircut(tenantA);

      await expect(createHaircut(tenantB)).resolves.toMatchObject({
        tenantId: 'tenant-b',
      });
    });

    it('rejects a malformed price', async () => {
      await expect(
        create.execute(tenantA, {
          name: 'Barba',
          durationMinutes: 20,
          price: '-5.00',
        }),
      ).rejects.toThrow(InvalidMoneyError);
    });
  });

  describe('UpdateService', () => {
    it('applies a partial change', async () => {
      const service = await createHaircut();

      const updated = await update.execute(tenantA, {
        serviceId: service.id,
        price: '35.50',
      });

      expect(updated.price.toDecimalString()).toBe('35.50');
      expect(updated.name).toBe('Corte de cabello');
    });

    it('lets a service keep its own name', async () => {
      const service = await createHaircut();

      await expect(
        update.execute(tenantA, {
          serviceId: service.id,
          name: 'Corte de cabello',
          price: '30.00',
        }),
      ).resolves.toMatchObject({ name: 'Corte de cabello' });
    });

    it('rejects taking the name of another active service', async () => {
      await createHaircut();
      const beard = await create.execute(tenantA, {
        name: 'Barba',
        durationMinutes: 20,
        price: '15.00',
      });

      await expect(
        update.execute(tenantA, {
          serviceId: beard.id,
          name: 'Corte de cabello',
        }),
      ).rejects.toThrow(DuplicateServiceNameError);
    });

    it('cannot touch a service of another tenant', async () => {
      const service = await createHaircut(tenantA);

      // The IDOR attempt: a real id used from the wrong session.
      await expect(
        update.execute(tenantB, { serviceId: service.id, price: '1.00' }),
      ).rejects.toThrow(ServiceNotFoundError);

      const untouched = await get.execute(tenantA, service.id);
      expect(untouched.price.toDecimalString()).toBe('25.00');
    });
  });

  describe('SetServiceStatus', () => {
    it('deactivates and reactivates', async () => {
      const service = await createHaircut();

      const deactivated = await setStatus.execute(tenantA, {
        serviceId: service.id,
        status: ServiceStatus.Inactive,
      });
      expect(deactivated.isActive).toBe(false);

      const reactivated = await setStatus.execute(tenantA, {
        serviceId: service.id,
        status: ServiceStatus.Active,
      });
      expect(reactivated.isActive).toBe(true);
    });

    it('cannot deactivate a service of another tenant', async () => {
      const service = await createHaircut(tenantA);

      await expect(
        setStatus.execute(tenantB, {
          serviceId: service.id,
          status: ServiceStatus.Inactive,
        }),
      ).rejects.toThrow(ServiceNotFoundError);
    });
  });

  describe('ListServices', () => {
    beforeEach(async () => {
      await create.execute(tenantA, {
        name: 'Corte de cabello',
        durationMinutes: 30,
        price: '25.00',
      });
      await create.execute(tenantA, {
        name: 'Barba',
        durationMinutes: 20,
        price: '15.00',
      });
      const tinte = await create.execute(tenantA, {
        name: 'Tinte',
        durationMinutes: 60,
        price: '60.00',
      });
      await setStatus.execute(tenantA, {
        serviceId: tinte.id,
        status: ServiceStatus.Inactive,
      });
      await create.execute(tenantB, {
        name: 'Servicio de otro negocio',
        durationMinutes: 30,
        price: '10.00',
      });
    });

    it('returns only the services of the caller tenant', async () => {
      const page = await list.execute(tenantA, { page: 1, limit: 20 });

      expect(page.meta.total).toBe(3);
      expect(
        page.items.every((service) => service.tenantId === 'tenant-a'),
      ).toBe(true);
    });

    it('sorts by name', async () => {
      const page = await list.execute(tenantA, { page: 1, limit: 20 });

      expect(page.items.map((service) => service.name)).toEqual([
        'Barba',
        'Corte de cabello',
        'Tinte',
      ]);
    });

    it('filters by status', async () => {
      const page = await list.execute(tenantA, {
        page: 1,
        limit: 20,
        status: ServiceStatus.Active,
      });

      expect(page.meta.total).toBe(2);
    });

    it('searches by name prefix', async () => {
      const page = await list.execute(tenantA, {
        page: 1,
        limit: 20,
        query: 'cor',
      });

      expect(page.items).toHaveLength(1);
      expect(page.items[0].name).toBe('Corte de cabello');
    });

    it('paginates with correct metadata', async () => {
      const page = await list.execute(tenantA, { page: 2, limit: 2 });

      expect(page.items).toHaveLength(1);
      expect(page.meta).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });
  });

  describe('GetService', () => {
    it('returns a service of the caller tenant', async () => {
      const service = await createHaircut(tenantA);

      await expect(get.execute(tenantA, service.id)).resolves.toMatchObject({
        id: service.id,
      });
    });

    it('reports another tenant service as not found, not as forbidden', async () => {
      const service = await createHaircut(tenantA);

      // 404, never 403: a 403 would confirm the id exists.
      await expect(get.execute(tenantB, service.id)).rejects.toThrow(
        ServiceNotFoundError,
      );
    });

    it('reports an unknown id as not found', async () => {
      await expect(get.execute(tenantA, 'does-not-exist')).rejects.toThrow(
        ServiceNotFoundError,
      );
    });
  });
});
