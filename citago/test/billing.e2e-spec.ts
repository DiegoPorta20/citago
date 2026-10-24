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

describe('Billing (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let owner: RegisteredBusiness;

  const server = () => app.getHttpServer();

  const subscription = (token: RegisteredBusiness = owner) =>
    request(server())
      .get(`${API}/billing/subscription`)
      .set(...authHeader(token));

  const choosePlan = (planCode: string, token: RegisteredBusiness = owner) =>
    request(server())
      .put(`${API}/billing/subscription/plan`)
      .set(...authHeader(token))
      .send({ planCode });

  const createService = (token: RegisteredBusiness = owner) =>
    request(server())
      .post(`${API}/services`)
      .set(...authHeader(token))
      .send({ name: 'Corte', durationMinutes: 30, price: '25.00' });

  const endTrial = (business: RegisteredBusiness) =>
    dataSource.query(
      'UPDATE `subscriptions` SET `trial_ends_at` = ? WHERE `tenant_id` = ?',
      [new Date(Date.now() - 60_000), business.tenantId],
    );

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

  describe('plans', () => {
    it('lists the three plans with decimal-string prices in soles', async () => {
      const response = await request(server())
        .get(`${API}/billing/plans`)
        .set(...authHeader(owner))
        .expect(200);

      const plans = response.body.data as {
        code: string;
        monthlyPrice: string;
        currency: string;
      }[];

      expect(plans.map((plan) => plan.code)).toEqual([
        'STARTER',
        'PRO',
        'BUSINESS',
      ]);
      expect(plans.every((plan) => plan.currency === 'PEN')).toBe(true);
      expect(plans.every((plan) => typeof plan.monthlyPrice === 'string')).toBe(
        true,
      );
    });

    it('requires a session', async () => {
      await request(server()).get(`${API}/billing/plans`).expect(401);
    });
  });

  describe('the free trial (BI-1)', () => {
    it('starts at registration: 7 days, Pro plan', async () => {
      const response = await subscription().expect(200);

      expect(response.body.data).toMatchObject({
        state: 'TRIALING',
        daysLeft: 7,
        plan: { code: 'PRO' },
      });
    });

    it('is created in the same transaction as the business', async () => {
      const rows = await queryRows<{ total: string }>(
        dataSource,
        'SELECT COUNT(*) AS total FROM `subscriptions` WHERE `tenant_id` = ?',
        [owner.tenantId],
      );

      expect(Number(rows[0].total)).toBe(1);
    });

    it('can be read by every role', async () => {
      const staff = await staffSession();

      await subscription(staff).expect(200);
    });
  });

  describe('choosing a plan', () => {
    it('lets the OWNER change it', async () => {
      const response = await choosePlan('STARTER').expect(200);

      expect(response.body.data.plan.code).toBe('STARTER');
      expect((await subscription()).body.data.plan.code).toBe('STARTER');
    });

    it('is forbidden to STAFF', async () => {
      const staff = await staffSession();

      await choosePlan('STARTER', staff).expect(403);
    });

    it('rejects a plan that does not exist', async () => {
      await choosePlan('FREE').expect(400);
    });

    it('only changes the caller’s business', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);

      await choosePlan('BUSINESS', tenantA).expect(200);

      expect((await subscription(tenantB)).body.data.plan.code).toBe('PRO');
    });
  });

  describe('after the trial ends (BI-2, BI-3)', () => {
    beforeEach(async () => {
      await endTrial(owner);
    });

    it('reports the subscription as expired', async () => {
      const response = await subscription().expect(200);

      expect(response.body.data).toMatchObject({
        state: 'EXPIRED',
        daysLeft: 0,
      });
    });

    it('blocks changes with 402 SUBSCRIPTION_EXPIRED', async () => {
      const response = await createService().expect(402);

      expect(response.body.code).toBe('SUBSCRIPTION_EXPIRED');
    });

    it('keeps everything readable', async () => {
      await request(server())
        .get(`${API}/services`)
        .set(...authHeader(owner))
        .expect(200);
      await request(server())
        .get(`${API}/business`)
        .set(...authHeader(owner))
        .expect(200);
    });

    it('still lets the OWNER choose a plan', async () => {
      await choosePlan('BUSINESS').expect(200);
    });

    it('still lets the user sign in and refresh', async () => {
      await request(server())
        .post(`${API}/auth/login`)
        .send({ email: owner.email, password: owner.password })
        .expect(200);
      await request(server())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: owner.refreshToken })
        .expect(200);
    });

    it('does not affect another business that is still in its trial', async () => {
      const other = await registerBusiness(app);

      await createService(other).expect(201);
    });
  });

  it('does not block a business in its trial', async () => {
    await createService().expect(201);
  });
});
