import { Email } from '../../../shared/domain/email.js';
import { PhoneNumber } from '../../../shared/domain/phone-number.js';
import { Client } from './client.entity.js';
import {
  ClientAlreadyDeletedError,
  InvalidClientDataError,
} from './errors/clients.errors.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const LATER = new Date('2026-09-18T12:00:00.000Z');

const validInput = {
  id: 'client-1',
  tenantId: 'tenant-1',
  name: 'Juan Pérez',
  phone: PhoneNumber.create('999999999', 'PE'),
};

describe('Client', () => {
  describe('create', () => {
    it('stores the phone in E.164', () => {
      const client = Client.create(validInput, NOW);

      expect(client.phone?.value).toBe('+51999999999');
      expect(client.isDeleted).toBe(false);
    });

    it('allows a client without phone, email or notes', () => {
      // A walk-in can be registered with a name alone.
      const client = Client.create(
        { id: 'client-2', tenantId: 'tenant-1', name: 'Sin teléfono' },
        NOW,
      );

      expect(client.phone).toBeNull();
      expect(client.email).toBeNull();
      expect(client.notes).toBeNull();
    });

    it('trims the name and rejects an empty one', () => {
      expect(Client.create({ ...validInput, name: '  Ana  ' }, NOW).name).toBe(
        'Ana',
      );
      expect(() => Client.create({ ...validInput, name: '   ' }, NOW)).toThrow(
        InvalidClientDataError,
      );
    });

    it('treats blank notes as absent and rejects huge ones', () => {
      expect(
        Client.create({ ...validInput, notes: '  ' }, NOW).notes,
      ).toBeNull();
      expect(() =>
        Client.create({ ...validInput, notes: 'x'.repeat(2001) }, NOW),
      ).toThrow(InvalidClientDataError);
    });
  });

  describe('update', () => {
    it('changes only what is provided and clears with null', () => {
      const client = Client.create(
        {
          ...validInput,
          email: Email.create('juan@correo.pe'),
          notes: 'Prefiere tijera',
        },
        NOW,
      );

      client.update({ email: null, name: 'Juan P.' }, LATER);

      expect(client.name).toBe('Juan P.');
      expect(client.email).toBeNull();
      expect(client.phone?.value).toBe('+51999999999');
      expect(client.notes).toBe('Prefiere tijera');
      expect(client.updatedAt).toEqual(LATER);
    });
  });

  describe('soft delete (rule CL-3)', () => {
    it('marks the client deleted but keeps every field, including the phone', () => {
      const client = Client.create(validInput, NOW);

      client.softDelete(LATER);

      expect(client.isDeleted).toBe(true);
      expect(client.deletedAt).toEqual(LATER);
      // Keeping the phone is what lets a re-registration offer a restore.
      expect(client.phone?.value).toBe('+51999999999');
    });

    it('refuses to delete twice', () => {
      const client = Client.create(validInput, NOW);
      client.softDelete(LATER);

      expect(() => client.softDelete(LATER)).toThrow(ClientAlreadyDeletedError);
    });

    it('can be restored', () => {
      const client = Client.create(validInput, NOW);
      client.softDelete(LATER);

      client.restore(LATER);

      expect(client.isDeleted).toBe(false);
      expect(client.deletedAt).toBeNull();
    });
  });

  describe('snapshot', () => {
    it('round-trips', () => {
      const client = Client.create(
        { ...validInput, email: Email.create('juan@correo.pe') },
        NOW,
      );

      expect(Client.restore(client.toSnapshot()).toSnapshot()).toEqual(
        client.toSnapshot(),
      );
    });

    it('exposes no visit or spending counters: those are computed (rule CL-5)', () => {
      const snapshot = Client.create(validInput, NOW).toSnapshot();

      expect(snapshot).not.toHaveProperty('totalVisits');
      expect(snapshot).not.toHaveProperty('totalSpent');
    });
  });
});
