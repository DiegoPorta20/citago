import { BusinessType } from './business-type.js';
import { InvalidTenantDataError } from './errors/invalid-tenant-data.error.js';
import { Tenant } from './tenant.entity.js';
import { TenantStatus } from './tenant-status.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');

const validInput = {
  id: 'tenant-1',
  name: 'Barbería Los Ángeles',
  slug: 'barberia-los-angeles',
  businessType: BusinessType.Barbershop,
  country: 'PE',
  currency: 'PEN',
  timezone: 'America/Lima',
};

describe('Tenant', () => {
  describe('create', () => {
    it('starts active with its settings', () => {
      const tenant = Tenant.create(validInput, NOW);

      expect(tenant.status).toBe(TenantStatus.Active);
      expect(tenant.isActive).toBe(true);
      expect(tenant.timezone).toBe('America/Lima');
      expect(tenant.createdAt).toEqual(NOW);
    });

    it('trims the business name', () => {
      const tenant = Tenant.create(
        { ...validInput, name: '  Barbería  ' },
        NOW,
      );

      expect(tenant.name).toBe('Barbería');
    });

    it('rejects an empty name', () => {
      expect(() => Tenant.create({ ...validInput, name: '   ' }, NOW)).toThrow(
        InvalidTenantDataError,
      );
    });

    it.each(['Barberia-Demo', 'barberia demo', '-barberia', 'barberia--demo'])(
      'rejects the malformed slug %s',
      (slug) => {
        expect(() => Tenant.create({ ...validInput, slug }, NOW)).toThrow(
          InvalidTenantDataError,
        );
      },
    );

    it.each(['pe', 'PER', 'P1'])('rejects the country code %s', (country) => {
      expect(() => Tenant.create({ ...validInput, country }, NOW)).toThrow(
        InvalidTenantDataError,
      );
    });

    it.each(['pen', 'PENN', 'SOLES1'])(
      'rejects the currency code %s',
      (currency) => {
        expect(() => Tenant.create({ ...validInput, currency }, NOW)).toThrow(
          InvalidTenantDataError,
        );
      },
    );

    it('rejects a time zone the runtime does not know', () => {
      // An unknown zone would silently break every agenda and daily total.
      expect(() =>
        Tenant.create({ ...validInput, timezone: 'America/Atlantis' }, NOW),
      ).toThrow(InvalidTenantDataError);
    });

    it('accepts any valid IANA zone, not only the launch market', () => {
      expect(() =>
        Tenant.create({ ...validInput, timezone: 'Europe/Madrid' }, NOW),
      ).not.toThrow();
    });
  });

  describe('lifecycle', () => {
    it('suspends and reactivates instead of being deleted', () => {
      const tenant = Tenant.create(validInput, NOW);
      const later = new Date('2026-09-18T12:00:00.000Z');

      tenant.suspend(later);
      expect(tenant.isActive).toBe(false);
      expect(tenant.updatedAt).toEqual(later);

      tenant.reactivate(later);
      expect(tenant.isActive).toBe(true);
    });

    it('validates settings when they change', () => {
      const tenant = Tenant.create(validInput, NOW);

      expect(() => tenant.updateSettings({ currency: 'soles' }, NOW)).toThrow(
        InvalidTenantDataError,
      );
      expect(tenant.currency).toBe('PEN');
    });

    it('updates only the settings provided', () => {
      const tenant = Tenant.create(validInput, NOW);

      tenant.updateSettings({ phone: '+51900000000' }, NOW);

      expect(tenant.phone).toBe('+51900000000');
      expect(tenant.timezone).toBe('America/Lima');
      expect(tenant.currency).toBe('PEN');
    });
  });

  describe('restore', () => {
    it('round-trips through a snapshot', () => {
      const tenant = Tenant.create(validInput, NOW);
      const restored = Tenant.restore(tenant.toSnapshot());

      expect(restored.toSnapshot()).toEqual(tenant.toSnapshot());
    });
  });
});
