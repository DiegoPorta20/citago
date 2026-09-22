import { getDataSourceToken } from '@nestjs/typeorm';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';

import { UserRole } from '../src/shared/domain/user-role.js';
import {
  API,
  authHeader,
  registerBusiness,
  type RegisteredBusiness,
} from './support/auth-flows.js';
import { createTestApp } from './support/create-test-app.js';
import { truncateAll } from './support/test-data-source.js';

describe('Business (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let owner: RegisteredBusiness;

  const server = () => app.getHttpServer();

  const read = (token: RegisteredBusiness = owner) =>
    request(server())
      .get(`${API}/business`)
      .set(...authHeader(token));

  const update = (
    body: Record<string, unknown>,
    token: RegisteredBusiness = owner,
  ) =>
    request(server())
      .patch(`${API}/business`)
      .set(...authHeader(token))
      .send(body);

  const setHours = (ranges: unknown[], token: RegisteredBusiness = owner) =>
    request(server())
      .put(`${API}/business/hours`)
      .set(...authHeader(token))
      .send({ ranges });

  /** A STAFF account of the same business, signed in. */
  const staffSession = async (): Promise<RegisteredBusiness> => {
    const email = `staff-${Math.random().toString(36).slice(2, 10)}@demo.local`;
    const password = 'unaClaveSegura1';

    await request(server())
      .post(`${API}/users`)
      .set(...authHeader(owner))
      .send({ name: 'Luis', email, role: UserRole.Staff, password })
      .expect(201);

    const login = await request(server())
      .post(`${API}/auth/login`)
      .send({ email, password })
      .expect(200);

    const session = login.body.data as Omit<
      RegisteredBusiness,
      'email' | 'password'
    >;

    return { ...session, email, password };
  };

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());
    await dataSource.runMigrations({ transaction: 'all' });
  }, 90_000);

  beforeEach(async () => {
    await truncateAll(dataSource);
    owner = await registerBusiness(app, { businessName: 'Barbería Demo' });
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('reading', () => {
    it('returns the settings the business signed up with, and no hours yet', async () => {
      const response = await read().expect(200);

      expect(response.body.data).toMatchObject({
        name: 'Barbería Demo',
        country: 'PE',
        currency: 'PEN',
        timezone: 'America/Lima',
        status: 'ACTIVE',
        phone: null,
        hours: [],
      });
      expect(response.body.data.slug).toEqual(expect.any(String));
    });

    it('is readable by every member: staff need the time zone too', async () => {
      const staff = await staffSession();

      await read(staff).expect(200);
    });
  });

  describe('editing', () => {
    it('renames, normalizes the phone and moves the time zone', async () => {
      const response = await update({
        name: 'Barbería Los Ángeles',
        phone: '999 999 999',
        email: 'hola@barberia.pe',
        timezone: 'America/Mexico_City',
      }).expect(200);

      expect(response.body.data).toMatchObject({
        name: 'Barbería Los Ángeles',
        phone: '+51999999999',
        email: 'hola@barberia.pe',
        timezone: 'America/Mexico_City',
      });
    });

    it('never lets the currency be changed', async () => {
      const response = await update({ currency: 'USD' }).expect(400);

      expect(response.body.message).toMatch(/currency/i);

      const after = await read().expect(200);

      expect(after.body.data.currency).toBe('PEN');
    });

    it('rejects a time zone that does not exist', async () => {
      await update({ timezone: 'Mars/Olympus' }).expect(400);
    });

    it('keeps STAFF out of the settings', async () => {
      const staff = await staffSession();

      await update({ name: 'Mía ahora' }, staff).expect(403);
      await setHours([], staff).expect(403);
    });
  });

  describe('opening hours (rule TZ-3)', () => {
    it('stores the week in the wall clock of the business', async () => {
      const response = await setHours([
        { weekday: 1, startsAt: '09:00', endsAt: '13:00' },
        { weekday: 1, startsAt: '15:00', endsAt: '20:00' },
        { weekday: 6, startsAt: '10:00', endsAt: '14:00' },
      ]).expect(200);

      expect(response.body.data.hours).toEqual([
        { weekday: 1, startsAt: '09:00', endsAt: '13:00' },
        { weekday: 1, startsAt: '15:00', endsAt: '20:00' },
        { weekday: 6, startsAt: '10:00', endsAt: '14:00' },
      ]);

      // They survive a settings change, and a re-read.
      await update({ name: 'Otro nombre' }).expect(200);

      const after = await read().expect(200);

      expect(after.body.data.hours).toHaveLength(3);
    });

    it('replaces the whole week, so an empty list closes the shop', async () => {
      await setHours([
        { weekday: 1, startsAt: '09:00', endsAt: '13:00' },
      ]).expect(200);

      const closed = await setHours([]).expect(200);

      expect(closed.body.data.hours).toEqual([]);
    });

    it('rejects overlapping ranges and malformed times', async () => {
      const overlap = await setHours([
        { weekday: 1, startsAt: '09:00', endsAt: '13:00' },
        { weekday: 1, startsAt: '12:00', endsAt: '20:00' },
      ]).expect(400);

      expect(overlap.body.code).toBe('INVALID_SCHEDULE');

      await setHours([{ weekday: 1, startsAt: '9am', endsAt: '13:00' }]).expect(
        400,
      );

      await setHours([
        { weekday: 8, startsAt: '09:00', endsAt: '13:00' },
      ]).expect(400);
    });
  });

  describe('tenant isolation (ADR 0004)', () => {
    it('never shows or edits another business', async () => {
      await update({ name: 'Solo mía' }).expect(200);
      await setHours([
        { weekday: 1, startsAt: '09:00', endsAt: '13:00' },
      ]).expect(200);

      const other = await registerBusiness(app, { businessName: 'Barbería B' });
      const response = await read(other).expect(200);

      expect(response.body.data.name).toBe('Barbería B');
      expect(response.body.data.hours).toEqual([]);

      await update({ name: 'Secuestrada' }, other).expect(200);

      const mine = await read().expect(200);

      expect(mine.body.data.name).toBe('Solo mía');
    });
  });
});
