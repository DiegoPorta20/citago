import {
  FixedClock,
  ImmediateTransactionRunner,
  InMemoryTenantRepository,
} from '../../../../test/support/fakes/identity.fakes.js';
import type { AuthContext } from '../../../shared/application/auth-context.js';
import { InvalidScheduleError } from '../../../shared/domain/weekly-schedule.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { BusinessType } from '../domain/business-type.js';
import { Tenant } from '../domain/tenant.entity.js';
import { TenantNotAvailableError } from '../domain/errors/tenant-not-available.error.js';
import {
  GetBusinessUseCase,
  ReplaceBusinessHoursUseCase,
  UpdateBusinessUseCase,
} from './business.use-cases.js';

const TENANT_ID = 'tenant-1';
const NOW = new Date('2026-09-21T15:00:00.000Z');

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: TENANT_ID,
  membershipId: 'membership-1',
  role: UserRole.Owner,
};

describe('Business settings', () => {
  let tenants: InMemoryTenantRepository;
  let read: GetBusinessUseCase;
  let update: UpdateBusinessUseCase;
  let setHours: ReplaceBusinessHoursUseCase;

  beforeEach(async () => {
    tenants = new InMemoryTenantRepository();
    await tenants.save(
      Tenant.create(
        {
          id: TENANT_ID,
          name: 'Barbería Demo',
          slug: 'barberia-demo',
          businessType: BusinessType.Barbershop,
          country: 'PE',
          currency: 'PEN',
          timezone: 'America/Lima',
        },
        NOW,
      ),
    );

    read = new GetBusinessUseCase(tenants);
    update = new UpdateBusinessUseCase(
      tenants,
      new ImmediateTransactionRunner(),
      new FixedClock(NOW),
    );
    setHours = new ReplaceBusinessHoursUseCase(tenants);
  });

  describe('reading', () => {
    it('answers with an empty week when the hours were never filled in', async () => {
      const view = await read.execute(actor);

      expect(view.tenant.name).toBe('Barbería Demo');
      expect(view.hours.all()).toEqual([]);
    });

    it('reports a business that is gone as not available', async () => {
      tenants.tenants.clear();

      await expect(read.execute(actor)).rejects.toThrow(
        TenantNotAvailableError,
      );
    });
  });

  describe('editing the settings', () => {
    it('normalizes the shop phone with the business country (rule CL-1)', async () => {
      const view = await update.execute(actor, { phone: '999 999 999' });

      expect(view.tenant.phone).toBe('+51999999999');
    });

    it('normalizes with the country sent in the same request', async () => {
      const view = await update.execute(actor, {
        country: 'ES',
        phone: '600 600 600',
      });

      expect(view.tenant.phone).toBe('+34600600600');
    });

    it('clears the phone and the email', async () => {
      await update.execute(actor, { phone: '999999999', email: 'a@b.pe' });

      const view = await update.execute(actor, { phone: null, email: '' });

      expect(view.tenant.phone).toBeNull();
      expect(view.tenant.email).toBeNull();
    });

    it('changes the time zone, which the agenda is read in from then on', async () => {
      const view = await update.execute(actor, {
        timezone: 'America/Mexico_City',
      });

      expect(view.tenant.timezone).toBe('America/Mexico_City');
    });

    it('leaves the currency alone whatever else changes', async () => {
      const view = await update.execute(actor, {
        name: 'Otro nombre',
        country: 'MX',
        timezone: 'America/Mexico_City',
      });

      expect(view.tenant.currency).toBe('PEN');
    });

    it('keeps the opening hours when the settings change', async () => {
      await setHours.execute(actor, [
        { weekday: 1, startsAt: '09:00', endsAt: '13:00' },
      ]);

      const view = await update.execute(actor, { name: 'Otro nombre' });

      expect(view.hours.all()).toHaveLength(1);
    });
  });

  describe('opening hours', () => {
    it('replaces the whole week, breaks included', async () => {
      const view = await setHours.execute(actor, [
        { weekday: 1, startsAt: '09:00', endsAt: '13:00' },
        { weekday: 1, startsAt: '15:00', endsAt: '20:00' },
        { weekday: 6, startsAt: '10:00', endsAt: '14:00' },
      ]);

      expect(view.hours.all()).toHaveLength(3);

      const closed = await setHours.execute(actor, []);

      expect(closed.hours.all()).toEqual([]);
    });

    it('refuses ranges that overlap, which are always a typo', async () => {
      await expect(
        setHours.execute(actor, [
          { weekday: 1, startsAt: '09:00', endsAt: '13:00' },
          { weekday: 1, startsAt: '12:00', endsAt: '20:00' },
        ]),
      ).rejects.toThrow(InvalidScheduleError);
    });

    it('refuses a range that ends before it starts', async () => {
      await expect(
        setHours.execute(actor, [
          { weekday: 1, startsAt: '20:00', endsAt: '09:00' },
        ]),
      ).rejects.toThrow(InvalidScheduleError);
    });
  });
});
