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
import { truncateAll } from './support/test-data-source.js';

describe('Services (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let owner: RegisteredBusiness;

  const createService = (
    business: RegisteredBusiness,
    body: Record<string, unknown> = {},
  ) =>
    request(app.getHttpServer())
      .post(`${API}/services`)
      .set(...authHeader(business))
      .send({
        name: 'Corte de cabello',
        durationMinutes: 30,
        price: '25.00',
        ...body,
      });

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

  describe('POST /services', () => {
    it('creates a service and returns it without internal fields', async () => {
      const response = await createService(owner, {
        description: 'Incluye lavado',
      }).expect(201);

      expect(response.body.data).toMatchObject({
        name: 'Corte de cabello',
        description: 'Incluye lavado',
        durationMinutes: 30,
        price: '25.00',
        status: 'ACTIVE',
      });
      // The tenant is never echoed back: clients must not learn to send it.
      expect(response.body.data.tenantId).toBeUndefined();
    });

    it('rejects a duplicate active name, ignoring case', async () => {
      await createService(owner).expect(201);

      const response = await createService(owner, {
        name: 'CORTE DE CABELLO',
      }).expect(409);

      expect(response.body.code).toBe('DUPLICATE_SERVICE_NAME');
    });

    it('accepts the name again once the first service is deactivated', async () => {
      const first = await createService(owner).expect(201);

      await request(app.getHttpServer())
        .post(`${API}/services/${first.body.data.id}/deactivate`)
        .set(...authHeader(owner))
        .expect(200);

      await createService(owner).expect(201);
    });

    it('rejects a price sent as a JSON number', async () => {
      // Money crosses the wire as a decimal string, so it never touches a float.
      const response = await createService(owner, { price: 25 }).expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it.each([
      ['a negative price', { price: '-5.00' }],
      ['three decimals', { price: '25.005' }],
      ['a zero duration', { durationMinutes: 0 }],
      ['a fractional duration', { durationMinutes: 30.5 }],
      ['an absurd duration', { durationMinutes: 1000 }],
      ['an empty name', { name: '' }],
    ])('rejects %s', async (_case, body) => {
      await createService(owner, body).expect(400);
    });

    it('refuses an unknown property', async () => {
      await createService(owner, { tenantId: 'someone-else' }).expect(400);
    });

    it('accepts a free service', async () => {
      const response = await createService(owner, {
        name: 'Consulta',
        price: '0',
      }).expect(201);

      expect(response.body.data.price).toBe('0.00');
    });
  });

  describe('GET /services', () => {
    beforeEach(async () => {
      await createService(owner, { name: 'Barba', price: '15.00' });
      await createService(owner, { name: 'Corte de cabello', price: '25.00' });
      const tinte = await createService(owner, {
        name: 'Tinte',
        price: '60.00',
      });

      await request(app.getHttpServer())
        .post(`${API}/services/${tinte.body.data.id}/deactivate`)
        .set(...authHeader(owner))
        .expect(200);
    });

    it('returns the catalogue ordered by name, with pagination meta', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/services`)
        .set(...authHeader(owner))
        .expect(200);

      expect(
        (response.body.data as { name: string }[]).map((s) => s.name),
      ).toEqual(['Barba', 'Corte de cabello', 'Tinte']);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });
    });

    it('filters by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/services?status=ACTIVE`)
        .set(...authHeader(owner))
        .expect(200);

      expect(response.body.meta.total).toBe(2);
    });

    it('searches by name', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/services?q=Cor`)
        .set(...authHeader(owner))
        .expect(200);

      expect(response.body.meta.total).toBe(1);
    });

    it('paginates', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/services?page=2&limit=2`)
        .set(...authHeader(owner))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.totalPages).toBe(2);
    });

    it('caps the page size, so no client can ask for everything', async () => {
      await request(app.getHttpServer())
        .get(`${API}/services?limit=10000`)
        .set(...authHeader(owner))
        .expect(400);
    });

    it('rejects an invalid status filter', async () => {
      await request(app.getHttpServer())
        .get(`${API}/services?status=WHATEVER`)
        .set(...authHeader(owner))
        .expect(400);
    });
  });

  describe('GET /services/:id', () => {
    it('returns one service', async () => {
      const created = await createService(owner).expect(201);

      const response = await request(app.getHttpServer())
        .get(`${API}/services/${created.body.data.id}`)
        .set(...authHeader(owner))
        .expect(200);

      expect(response.body.data.id).toBe(created.body.data.id);
    });

    it('rejects an id that is not a UUID', async () => {
      await request(app.getHttpServer())
        .get(`${API}/services/not-a-uuid`)
        .set(...authHeader(owner))
        .expect(400);
    });

    it('returns 404 for an unknown service', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/services/01999999-0000-7000-8000-000000009999`)
        .set(...authHeader(owner))
        .expect(404);

      expect(response.body.code).toBe('SERVICE_NOT_FOUND');
    });
  });

  describe('PATCH /services/:id', () => {
    it('applies a partial change', async () => {
      const created = await createService(owner, {
        description: 'Incluye lavado',
      }).expect(201);

      const response = await request(app.getHttpServer())
        .patch(`${API}/services/${created.body.data.id}`)
        .set(...authHeader(owner))
        .send({ price: '35.50', durationMinutes: 45 })
        .expect(200);

      expect(response.body.data).toMatchObject({
        name: 'Corte de cabello',
        description: 'Incluye lavado',
        price: '35.50',
        durationMinutes: 45,
      });
    });

    it('clears the description with an empty string', async () => {
      const created = await createService(owner, {
        description: 'Incluye lavado',
      }).expect(201);

      const response = await request(app.getHttpServer())
        .patch(`${API}/services/${created.body.data.id}`)
        .set(...authHeader(owner))
        .send({ description: '' })
        .expect(200);

      expect(response.body.data.description).toBeNull();
    });
  });

  describe('activate and deactivate', () => {
    it('takes a service off the menu and puts it back', async () => {
      const created = await createService(owner).expect(201);
      const id = created.body.data.id as string;

      const deactivated = await request(app.getHttpServer())
        .post(`${API}/services/${id}/deactivate`)
        .set(...authHeader(owner))
        .expect(200);
      expect(deactivated.body.data.status).toBe('INACTIVE');

      const activated = await request(app.getHttpServer())
        .post(`${API}/services/${id}/activate`)
        .set(...authHeader(owner))
        .expect(200);
      expect(activated.body.data.status).toBe('ACTIVE');
    });

    it('is idempotent, so a retry is safe', async () => {
      const created = await createService(owner).expect(201);
      const id = created.body.data.id as string;

      await request(app.getHttpServer())
        .post(`${API}/services/${id}/deactivate`)
        .set(...authHeader(owner))
        .expect(200);

      const second = await request(app.getHttpServer())
        .post(`${API}/services/${id}/deactivate`)
        .set(...authHeader(owner))
        .expect(200);

      expect(second.body.data.status).toBe('INACTIVE');
    });

    it('offers no DELETE: history is never destroyed (rule CA-3)', async () => {
      const created = await createService(owner).expect(201);

      await request(app.getHttpServer())
        .delete(`${API}/services/${created.body.data.id}`)
        .set(...authHeader(owner))
        .expect(404);
    });
  });

  describe('authorization', () => {
    const asStaff = async (): Promise<RegisteredBusiness> => {
      const staff = await registerBusiness(app, { email: 'staff@demo.local' });

      // There is no invite endpoint yet (that is user management), so the role
      // is downgraded directly. The guard reads it from the membership on every
      // request, so the existing token now behaves as STAFF.
      await dataSource.query(
        'UPDATE memberships SET role = ? WHERE user_id = ?',
        [UserRole.Staff, staff.userId],
      );

      return staff;
    };

    it('lets STAFF read the catalogue', async () => {
      const staff = await asStaff();

      await request(app.getHttpServer())
        .get(`${API}/services`)
        .set(...authHeader(staff))
        .expect(200);
    });

    it('forbids STAFF from creating a service', async () => {
      const staff = await asStaff();

      const response = await request(app.getHttpServer())
        .post(`${API}/services`)
        .set(...authHeader(staff))
        .send({ name: 'Corte', durationMinutes: 30, price: '25.00' })
        .expect(403);

      expect(response.body.code).toBe('INSUFFICIENT_ROLE');
      expect(response.body.details).toEqual({
        required: [UserRole.Owner, UserRole.Admin],
      });
    });

    it('forbids STAFF from editing or deactivating a service', async () => {
      const staff = await asStaff();
      const created = await createService(owner).expect(201);
      const id = created.body.data.id as string;

      await request(app.getHttpServer())
        .patch(`${API}/services/${id}`)
        .set(...authHeader(staff))
        .send({ price: '1.00' })
        .expect(403);

      await request(app.getHttpServer())
        .post(`${API}/services/${id}/deactivate`)
        .set(...authHeader(staff))
        .expect(403);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer()).get(`${API}/services`).expect(401);
      await request(app.getHttpServer())
        .post(`${API}/services`)
        .send({ name: 'Corte', durationMinutes: 30, price: '25.00' })
        .expect(401);
    });
  });

  describe('tenant isolation', () => {
    it('keeps each catalogue private', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);

      await createService(tenantA, { name: 'Corte de A' }).expect(201);

      const listB = await request(app.getHttpServer())
        .get(`${API}/services`)
        .set(...authHeader(tenantB))
        .expect(200);

      expect(listB.body.data).toEqual([]);
      expect(listB.body.meta.total).toBe(0);
    });

    it('answers 404, not 403, when reading another tenant service', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);
      const created = await createService(tenantA).expect(201);

      // 403 would confirm the id exists. 404 reveals nothing.
      const response = await request(app.getHttpServer())
        .get(`${API}/services/${created.body.data.id}`)
        .set(...authHeader(tenantB))
        .expect(404);

      expect(response.body.code).toBe('SERVICE_NOT_FOUND');
    });

    it('cannot modify another tenant service', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);
      const created = await createService(tenantA).expect(201);
      const id = created.body.data.id as string;

      await request(app.getHttpServer())
        .patch(`${API}/services/${id}`)
        .set(...authHeader(tenantB))
        .send({ price: '0.01' })
        .expect(404);

      await request(app.getHttpServer())
        .post(`${API}/services/${id}/deactivate`)
        .set(...authHeader(tenantB))
        .expect(404);

      // The original is untouched.
      const unchanged = await request(app.getHttpServer())
        .get(`${API}/services/${id}`)
        .set(...authHeader(tenantA))
        .expect(200);

      expect(unchanged.body.data).toMatchObject({
        price: '25.00',
        status: 'ACTIVE',
      });
    });

    it('lets two businesses use the same service name', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);

      await createService(tenantA).expect(201);
      await createService(tenantB).expect(201);
    });
  });
});
