import { getDataSourceToken } from '@nestjs/typeorm';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';

import { UserRole } from '../src/shared/domain/user-role.js';
import { STANDARD_WEEK } from './support/agenda-fixtures.js';
import {
  API,
  authHeader,
  createTwoTenants,
  registerBusiness,
  type RegisteredBusiness,
} from './support/auth-flows.js';
import { createTestApp } from './support/create-test-app.js';
import { queryRows, truncateAll } from './support/test-data-source.js';

describe('Staff (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let owner: RegisteredBusiness;

  const server = () => app.getHttpServer();

  const createStaff = (business: RegisteredBusiness, body: object) =>
    request(server())
      .post(`${API}/staff`)
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

  it('creates a barber without an account and sets their week', async () => {
    const created = await createStaff(owner, { displayName: 'Carlos' }).expect(
      201,
    );

    expect(created.body.data).toMatchObject({
      displayName: 'Carlos',
      userId: null,
      status: 'ACTIVE',
      schedule: [],
    });

    const scheduled = await request(server())
      .put(`${API}/staff/${created.body.data.id}/schedule`)
      .set(...authHeader(owner))
      .send({ ranges: STANDARD_WEEK })
      .expect(200);

    expect(scheduled.body.data.schedule).toHaveLength(12);
    expect(scheduled.body.data.schedule[0]).toEqual({
      weekday: 1,
      startsAt: '09:00',
      endsAt: '13:00',
    });
  });

  it.each([
    [
      'overlapping ranges on one day',
      [
        { weekday: 1, startsAt: '09:00', endsAt: '13:00' },
        { weekday: 1, startsAt: '12:00', endsAt: '18:00' },
      ],
      'INVALID_SCHEDULE',
    ],
    [
      'a range that ends before it starts',
      [{ weekday: 2, startsAt: '18:00', endsAt: '09:00' }],
      'INVALID_SCHEDULE',
    ],
    [
      'an impossible weekday',
      [{ weekday: 8, startsAt: '09:00', endsAt: '13:00' }],
      'VALIDATION_ERROR',
    ],
    [
      'a malformed time',
      [{ weekday: 1, startsAt: '9:00', endsAt: '13:00' }],
      'VALIDATION_ERROR',
    ],
  ])('rejects a schedule with %s', async (_case, ranges, code) => {
    const created = await createStaff(owner, { displayName: 'Carlos' }).expect(
      201,
    );

    const response = await request(server())
      .put(`${API}/staff/${created.body.data.id}/schedule`)
      .set(...authHeader(owner))
      .send({ ranges })
      .expect(400);

    expect(response.body.code).toBe(code);
  });

  it('links an account of this business, and only one staff member per account', async () => {
    const linked = await createStaff(owner, {
      displayName: 'Dueño que corta',
      userId: owner.userId,
    }).expect(201);

    expect(linked.body.data.userId).toBe(owner.userId);

    const second = await createStaff(owner, {
      displayName: 'Otro',
      userId: owner.userId,
    }).expect(409);

    expect(second.body.code).toBe('USER_ALREADY_LINKED_TO_STAFF');
  });

  it('refuses to link an account from another business', async () => {
    const stranger = await registerBusiness(app);

    const response = await createStaff(owner, {
      displayName: 'Intruso',
      userId: stranger.userId,
    }).expect(422);

    expect(response.body.code).toBe('USER_NOT_MEMBER_OF_TENANT');
  });

  it('manages time off', async () => {
    const created = await createStaff(owner, { displayName: 'Carlos' }).expect(
      201,
    );
    const id = created.body.data.id as string;

    const off = await request(server())
      .post(`${API}/staff/${id}/time-off`)
      .set(...authHeader(owner))
      .send({
        startsAt: '2026-12-24T05:00:00.000Z',
        endsAt: '2026-12-26T05:00:00.000Z',
        reason: 'Navidad',
      })
      .expect(201);

    const listed = await request(server())
      .get(`${API}/staff/${id}/time-off`)
      .query({
        from: '2026-12-01T00:00:00.000Z',
        to: '2027-01-01T00:00:00.000Z',
      })
      .set(...authHeader(owner))
      .expect(200);

    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].reason).toBe('Navidad');

    await request(server())
      .delete(`${API}/staff/${id}/time-off/${off.body.data.id}`)
      .set(...authHeader(owner))
      .expect(204);
  });

  it('rejects time off that ends before it starts', async () => {
    const created = await createStaff(owner, { displayName: 'Carlos' }).expect(
      201,
    );

    const response = await request(server())
      .post(`${API}/staff/${created.body.data.id}/time-off`)
      .set(...authHeader(owner))
      .send({
        startsAt: '2026-12-26T05:00:00.000Z',
        endsAt: '2026-12-24T05:00:00.000Z',
      })
      .expect(400);

    expect(response.body.code).toBe('INVALID_TIME_OFF');
  });

  it('lets STAFF read the team but not change it', async () => {
    const created = await createStaff(owner, { displayName: 'Carlos' }).expect(
      201,
    );
    await dataSource.query(
      'UPDATE memberships SET role = ? WHERE user_id = ?',
      [UserRole.Staff, owner.userId],
    );

    await request(server())
      .get(`${API}/staff`)
      .set(...authHeader(owner))
      .expect(200);

    await request(server())
      .put(`${API}/staff/${created.body.data.id}/schedule`)
      .set(...authHeader(owner))
      .send({ ranges: STANDARD_WEEK })
      .expect(403);
  });

  describe('tenant isolation', () => {
    it('keeps each team private and answers 404 across tenants', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);
      const created = await createStaff(tenantA, {
        displayName: 'Carlos',
      }).expect(201);
      const id = created.body.data.id as string;

      const list = await request(server())
        .get(`${API}/staff`)
        .set(...authHeader(tenantB))
        .expect(200);
      expect(list.body.data).toEqual([]);

      await request(server())
        .get(`${API}/staff/${id}`)
        .set(...authHeader(tenantB))
        .expect(404);
      await request(server())
        .put(`${API}/staff/${id}/schedule`)
        .set(...authHeader(tenantB))
        .send({ ranges: STANDARD_WEEK })
        .expect(404);
      await request(server())
        .post(`${API}/staff/${id}/time-off`)
        .set(...authHeader(tenantB))
        .send({
          startsAt: '2026-12-24T05:00:00.000Z',
          endsAt: '2026-12-26T05:00:00.000Z',
        })
        .expect(404);
    });

    it('refuses to delete another tenant time off through a valid parent id', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);
      const staffA = await createStaff(tenantA, { displayName: 'A' }).expect(
        201,
      );
      const staffB = await createStaff(tenantB, { displayName: 'B' }).expect(
        201,
      );

      const off = await request(server())
        .post(`${API}/staff/${staffA.body.data.id}/time-off`)
        .set(...authHeader(tenantA))
        .send({
          startsAt: '2026-12-24T05:00:00.000Z',
          endsAt: '2026-12-26T05:00:00.000Z',
        })
        .expect(201);

      // B uses its own staff id in the URL with A's time-off id.
      await request(server())
        .delete(
          `${API}/staff/${staffB.body.data.id}/time-off/${off.body.data.id}`,
        )
        .set(...authHeader(tenantB))
        .expect(404);

      const stillThere = await queryRows<{ total: number }>(
        dataSource,
        'SELECT COUNT(*) AS total FROM staff_time_off WHERE id = ?',
        [off.body.data.id],
      );

      expect(Number(stillThere[0].total)).toBe(1);
    });
  });
});
