import { Money } from '../../../shared/domain/money.js';
import { InvalidServiceDataError } from './errors/catalog.errors.js';
import { Service } from './service.entity.js';
import { ServiceStatus } from './service-status.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const LATER = new Date('2026-09-18T12:00:00.000Z');

const validInput = {
  id: 'service-1',
  tenantId: 'tenant-1',
  name: 'Corte de cabello',
  durationMinutes: 30,
  price: Money.fromDecimalString('25.00'),
};

describe('Service', () => {
  describe('create', () => {
    it('is born active, with its price and duration', () => {
      const service = Service.create(validInput, NOW);

      expect(service.status).toBe(ServiceStatus.Active);
      expect(service.isActive).toBe(true);
      expect(service.price.toDecimalString()).toBe('25.00');
      expect(service.durationMinutes).toBe(30);
      expect(service.description).toBeNull();
    });

    it('trims the name', () => {
      const service = Service.create({ ...validInput, name: '  Barba  ' }, NOW);

      expect(service.name).toBe('Barba');
    });

    it('treats a blank description as absent', () => {
      const service = Service.create(
        { ...validInput, description: '   ' },
        NOW,
      );

      expect(service.description).toBeNull();
    });

    it('rejects an empty name', () => {
      expect(() => Service.create({ ...validInput, name: '  ' }, NOW)).toThrow(
        InvalidServiceDataError,
      );
    });

    it('rejects a name longer than the column', () => {
      expect(() =>
        Service.create({ ...validInput, name: 'a'.repeat(121) }, NOW),
      ).toThrow(InvalidServiceDataError);
    });

    it.each([[0], [-15], [15.5]])(
      'rejects the duration %s (rule CA-1)',
      (durationMinutes) => {
        expect(() =>
          Service.create({ ...validInput, durationMinutes }, NOW),
        ).toThrow(InvalidServiceDataError);
      },
    );

    it('rejects an absurd duration', () => {
      // More than twelve hours is a typo, not a haircut.
      expect(() =>
        Service.create({ ...validInput, durationMinutes: 721 }, NOW),
      ).toThrow(InvalidServiceDataError);
    });

    it('accepts a free service (rule CA-2 allows zero)', () => {
      const service = Service.create(
        { ...validInput, price: Money.zero() },
        NOW,
      );

      expect(service.price.isZero()).toBe(true);
    });
  });

  describe('update', () => {
    it('changes only the fields provided', () => {
      const service = Service.create(
        { ...validInput, description: 'Incluye lavado' },
        NOW,
      );

      service.update({ price: Money.fromDecimalString('35.00') }, LATER);

      expect(service.price.toDecimalString()).toBe('35.00');
      expect(service.name).toBe('Corte de cabello');
      expect(service.description).toBe('Incluye lavado');
      expect(service.durationMinutes).toBe(30);
      expect(service.updatedAt).toEqual(LATER);
    });

    it('clears the description when given an empty string', () => {
      const service = Service.create(
        { ...validInput, description: 'Incluye lavado' },
        NOW,
      );

      service.update({ description: '' }, LATER);

      expect(service.description).toBeNull();
    });

    it('validates the new values', () => {
      const service = Service.create(validInput, NOW);

      expect(() => service.update({ durationMinutes: 0 }, LATER)).toThrow(
        InvalidServiceDataError,
      );
      // The rejected change left nothing behind.
      expect(service.durationMinutes).toBe(30);
      expect(service.updatedAt).toEqual(NOW);
    });
  });

  describe('status', () => {
    it('deactivates instead of being deleted (rule CA-3)', () => {
      const service = Service.create(validInput, NOW);

      service.deactivate(LATER);

      expect(service.status).toBe(ServiceStatus.Inactive);
      expect(service.isActive).toBe(false);
      expect(service.updatedAt).toEqual(LATER);
    });

    it('can be put back on the menu', () => {
      const service = Service.create(validInput, NOW);

      service.deactivate(LATER);
      service.activate(LATER);

      expect(service.isActive).toBe(true);
    });

    it('is idempotent, so a retried request is harmless', () => {
      const service = Service.create(validInput, NOW);

      service.activate(LATER);

      expect(service.isActive).toBe(true);
      // No spurious touch of updatedAt when nothing changed.
      expect(service.updatedAt).toEqual(NOW);
    });
  });

  describe('snapshot', () => {
    it('round-trips, keeping the price exact', () => {
      const service = Service.create(
        { ...validInput, price: Money.fromDecimalString('0.05') },
        NOW,
      );

      const restored = Service.restore(service.toSnapshot());

      expect(restored.toSnapshot()).toEqual(service.toSnapshot());
      expect(restored.price.toDecimalString()).toBe('0.05');
    });

    it('exposes the price as a decimal string, not a number', () => {
      const snapshot = Service.create(validInput, NOW).toSnapshot();

      expect(snapshot.price).toBe('25.00');
      expect(typeof snapshot.price).toBe('string');
    });
  });
});
