import { getDataSourceToken } from '@nestjs/typeorm';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';

import { UserRole } from '../src/shared/domain/user-role.js';
import {
  API,
  authHeader,
  createTwoTenants,
  registerBusiness,
  type RegisteredBusiness,
} from './support/auth-flows.js';
import { createTestApp } from './support/create-test-app.js';
import { queryRows, truncateAll } from './support/test-data-source.js';

describe('Clients (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let owner: RegisteredBusiness;

  const createClient = (
    business: RegisteredBusiness,
    body: Record<string, unknown>,
  ) =>
    request(app.getHttpServer())
      .post(`${API}/clients`)
      .set(...authHeader(business))
      .send(body);

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());
    await dataSource.runMigrations({ transaction: 'all' });
  }, 90_000);

  beforeEach(async () => {
    await truncateAll(dataSource);
    owner = await registerBusiness(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('POST /clients', () => {
    it('registers a client with the phone normalized to E.164', async () => {
      const response = await createClient(owner, {
        name: 'Juan Pérez',
        phone: '999 999 999',
        email: 'Juan@Correo.PE',
      }).expect(201);

      expect(response.body.data).toMatchObject({
        name: 'Juan Pérez',
        phone: '+51999999999',
        email: 'juan@correo.pe',
      });
      expect(response.body.data.tenantId).toBeUndefined();
    });

    it('registers walk-ins without a phone', async () => {
      await createClient(owner, { name: 'Walk-in 1' }).expect(201);
      await createClient(owner, { name: 'Walk-in 2' }).expect(201);
    });

    it('recognizes the same phone typed differently, and points at the existing client', async () => {
      const first = await createClient(owner, {
        name: 'Juan',
        phone: '999999999',
      }).expect(201);

      const response = await createClient(owner, {
        name: 'Juan otra vez',
        phone: '+51 999-999-999',
      }).expect(409);

      expect(response.body.code).toBe('CLIENT_PHONE_ALREADY_REGISTERED');
      expect(response.body.details).toEqual({ clientId: first.body.data.id });
    });

    it.each([
      [
        'an impossible phone',
        { name: 'X', phone: '123' },
        'INVALID_PHONE_NUMBER',
      ],
      ['a malformed email', { name: 'X', email: 'nope' }, 'VALIDATION_ERROR'],
      ['an empty name', { name: '' }, 'VALIDATION_ERROR'],
    ])('rejects %s', async (_case, body, code) => {
      const response = await createClient(owner, body).expect(400);

      expect(response.body.code).toBe(code);
    });
  });

  describe('delete and restore (decision F4)', () => {
    it('soft-deletes, then offers the original back instead of duplicating it', async () => {
      const created = await createClient(owner, {
        name: 'Juan',
        phone: '999999999',
      }).expect(201);
      const id = created.body.data.id as string;

      await request(app.getHttpServer())
        .delete(`${API}/clients/${id}`)
        .set(...authHeader(owner))
        .expect(204);

      await request(app.getHttpServer())
        .get(`${API}/clients/${id}`)
        .set(...authHeader(owner))
        .expect(404);

      const conflict = await createClient(owner, {
        name: 'Juan',
        phone: '999 999 999',
      }).expect(409);

      expect(conflict.body.code).toBe('CLIENT_DELETED_WITH_SAME_PHONE');
      expect(conflict.body.details).toEqual({ clientId: id, restorable: true });

      const restored = await request(app.getHttpServer())
        .post(`${API}/clients/${id}/restore`)
        .set(...authHeader(owner))
        .expect(200);

      expect(restored.body.data).toMatchObject({ id, phone: '+51999999999' });
    });

    it('keeps the database row: history must keep its customer (rule CL-3)', async () => {
      const created = await createClient(owner, { name: 'Juan' }).expect(201);

      await request(app.getHttpServer())
        .delete(`${API}/clients/${created.body.data.id}`)
        .set(...authHeader(owner))
        .expect(204);

      const rows = await queryRows<{ deleted_at: Date | null }>(
        dataSource,
        'SELECT deleted_at FROM clients WHERE id = ?',
        [created.body.data.id],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].deleted_at).not.toBeNull();
    });
  });

  describe('GET /clients', () => {
    beforeEach(async () => {
      await createClient(owner, { name: 'Ana Torres', phone: '988888888' });
      await createClient(owner, { name: 'Juan Pérez', phone: '999999999' });
      await createClient(owner, { name: 'Juana Ríos' });
    });

    it('lists clients by name with pagination meta', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/clients`)
        .set(...authHeader(owner))
        .expect(200);

      expect(
        (response.body.data as { name: string }[]).map((client) => client.name),
      ).toEqual(['Ana Torres', 'Juan Pérez', 'Juana Ríos']);
      expect(response.body.meta.total).toBe(3);
    });

    it('finds a client by the phone digits the barber remembers', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/clients`)
        .query({ q: '999 999' })
        .set(...authHeader(owner))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Juan Pérez');
    });
  });

  describe('PATCH /clients/:id', () => {
    it('updates and clears optional fields with an empty string', async () => {
      const created = await createClient(owner, {
        name: 'Juan',
        phone: '999999999',
        email: 'juan@correo.pe',
      }).expect(201);

      const response = await request(app.getHttpServer())
        .patch(`${API}/clients/${created.body.data.id}`)
        .set(...authHeader(owner))
        .send({ name: 'Juan Pérez', email: '', notes: 'Prefiere tijera' })
        .expect(200);

      expect(response.body.data).toMatchObject({
        name: 'Juan Pérez',
        email: null,
        phone: '+51999999999',
        notes: 'Prefiere tijera',
      });
    });
  });

  describe('authorization', () => {
    it('lets STAFF register and edit clients, but not delete them', async () => {
      const staff = await registerBusiness(app, {
        email: 'barbero@demo.local',
      });
      await dataSource.query(
        'UPDATE memberships SET role = ? WHERE user_id = ?',
        [UserRole.Staff, staff.userId],
      );

      const created = await createClient(staff, { name: 'Cliente' }).expect(
        201,
      );
      const id = created.body.data.id as string;

      await request(app.getHttpServer())
        .patch(`${API}/clients/${id}`)
        .set(...authHeader(staff))
        .send({ notes: 'Llega siempre tarde' })
        .expect(200);

      const denied = await request(app.getHttpServer())
        .delete(`${API}/clients/${id}`)
        .set(...authHeader(staff))
        .expect(403);

      expect(denied.body.code).toBe('INSUFFICIENT_ROLE');
    });
  });

  describe('tenant isolation', () => {
    it('keeps each client list private', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);
      await createClient(tenantA, { name: 'Cliente de A' }).expect(201);

      const response = await request(app.getHttpServer())
        .get(`${API}/clients`)
        .set(...authHeader(tenantB))
        .expect(200);

      expect(response.body.meta.total).toBe(0);
    });

    it('answers 404 to every operation on another tenant client', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);
      const created = await createClient(tenantA, {
        name: 'Cliente de A',
        phone: '999999999',
      }).expect(201);
      const id = created.body.data.id as string;
      const server = app.getHttpServer();

      await request(server)
        .get(`${API}/clients/${id}`)
        .set(...authHeader(tenantB))
        .expect(404);
      await request(server)
        .patch(`${API}/clients/${id}`)
        .set(...authHeader(tenantB))
        .send({ name: 'Hacked' })
        .expect(404);
      await request(server)
        .delete(`${API}/clients/${id}`)
        .set(...authHeader(tenantB))
        .expect(404);
      await request(server)
        .post(`${API}/clients/${id}/restore`)
        .set(...authHeader(tenantB))
        .expect(404);

      const untouched = await request(server)
        .get(`${API}/clients/${id}`)
        .set(...authHeader(tenantA))
        .expect(200);

      expect(untouched.body.data.name).toBe('Cliente de A');
    });

    it('lets two businesses have a client with the same phone', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);

      await createClient(tenantA, { name: 'Juan', phone: '999999999' }).expect(
        201,
      );
      await createClient(tenantB, { name: 'Juan', phone: '999999999' }).expect(
        201,
      );
    });

    it('does not reveal through a conflict that a phone exists in another tenant', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);
      await createClient(tenantA, { name: 'Juan', phone: '999999999' });

      // A 409 here would leak tenant A's customer list to tenant B.
      await createClient(tenantB, { name: 'Pedro', phone: '999999999' }).expect(
        201,
      );
    });
  });
});
