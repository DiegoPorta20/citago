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

describe('Switch tenant (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;

  const server = () => app.getHttpServer();

  const MEMBER_EMAIL = 'juan@demo.local';
  const MEMBER_PASSWORD = 'unaClaveSegura1';

  const login = (email: string, password: string) =>
    request(server()).post(`${API}/auth/login`).send({ email, password });

  const addMember = (
    owner: RegisteredBusiness,
    body: Record<string, unknown>,
  ) =>
    request(server())
      .post(`${API}/users`)
      .set(...authHeader(owner))
      .send(body);

  const memberOfTwoBusinesses = async (): Promise<{
    businessA: RegisteredBusiness;
    businessB: RegisteredBusiness;
    session: {
      accessToken: string;
      refreshToken: string;
      tenantId: string;
      userId: string;
      role: UserRole;
    };
  }> => {
    const businessA = await registerBusiness(app, {
      businessName: 'Negocio A',
    });
    const businessB = await registerBusiness(app, {
      businessName: 'Negocio B',
    });

    await addMember(businessA, {
      name: 'Juan',
      email: MEMBER_EMAIL,
      role: UserRole.Staff,
      password: MEMBER_PASSWORD,
    }).expect(201);

    await addMember(businessB, {
      name: 'Juan',
      email: MEMBER_EMAIL,
      role: UserRole.Admin,
    }).expect(201);

    const signedIn = await login(MEMBER_EMAIL, MEMBER_PASSWORD).expect(200);

    return { businessA, businessB, session: signedIn.body.data };
  };

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());
    await dataSource.runMigrations({ transaction: 'all' });
  }, 90_000);

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /auth/tenants', () => {
    it('lists both businesses, flagging the current one', async () => {
      const { businessA, businessB, session } = await memberOfTwoBusinesses();

      const response = await request(server())
        .get(`${API}/auth/tenants`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      const rows = response.body.data as Array<{
        tenantId: string;
        tenantName: string;
        role: UserRole;
        current: boolean;
      }>;

      expect(rows).toHaveLength(2);

      const current = rows.find((row) => row.current);
      const other = rows.find((row) => !row.current);

      expect(current?.tenantId).toBe(businessA.tenantId);
      expect(current?.tenantName).toBe('Negocio A');
      expect(current?.role).toBe(UserRole.Staff);

      expect(other?.tenantId).toBe(businessB.tenantId);
      expect(other?.tenantName).toBe('Negocio B');
      expect(other?.role).toBe(UserRole.Admin);
    });

    it('is not public', async () => {
      await request(server()).get(`${API}/auth/tenants`).expect(401);
    });
  });

  describe('POST /auth/switch-tenant', () => {
    it('issues a session for the other business and kills the old one', async () => {
      const { businessB, session } = await memberOfTwoBusinesses();

      const switched = await request(server())
        .post(`${API}/auth/switch-tenant`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          tenantId: businessB.tenantId,
          refreshToken: session.refreshToken,
        })
        .expect(200);

      expect(switched.body.data).toMatchObject({
        tenantId: businessB.tenantId,
        userId: session.userId,
        role: UserRole.Admin,
        expiresIn: 900,
      });
      expect(switched.body.data.accessToken).toEqual(expect.any(String));
      expect(switched.body.data.refreshToken).not.toBe(session.refreshToken);

      const me = await request(server())
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${switched.body.data.accessToken}`)
        .expect(200);
      expect(me.body.data.tenant.id).toBe(businessB.tenantId);

      await request(server())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      await request(server())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: switched.body.data.refreshToken })
        .expect(200);
    });

    it('answers 404 NOT_A_MEMBER for a business the caller does not belong to', async () => {
      const { session } = await memberOfTwoBusinesses();
      const stranger = await registerBusiness(app, {
        businessName: 'Ajeno',
      });

      const response = await request(server())
        .post(`${API}/auth/switch-tenant`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          tenantId: stranger.tenantId,
          refreshToken: session.refreshToken,
        })
        .expect(404);

      expect(response.body.code).toBe('NOT_A_MEMBER');
    });

    it('answers 404 NOT_A_MEMBER for a tenant that does not exist', async () => {
      const { session } = await memberOfTwoBusinesses();

      const response = await request(server())
        .post(`${API}/auth/switch-tenant`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          tenantId: '00000000-0000-4000-8000-000000000000',
          refreshToken: session.refreshToken,
        })
        .expect(404);

      expect(response.body.code).toBe('NOT_A_MEMBER');
    });

    it('rejects a refresh token that belongs to another user', async () => {
      const { businessB, session } = await memberOfTwoBusinesses();
      const other = await registerBusiness(app, { businessName: 'Otro' });

      const response = await request(server())
        .post(`${API}/auth/switch-tenant`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          tenantId: businessB.tenantId,
          refreshToken: other.refreshToken,
        })
        .expect(401);

      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('is not public', async () => {
      await request(server())
        .post(`${API}/auth/switch-tenant`)
        .send({
          tenantId: '00000000-0000-4000-8000-000000000000',
          refreshToken: 'whatever',
        })
        .expect(401);
    });
  });
});
