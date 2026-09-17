import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

import { UserRole } from '../src/shared/domain/user-role.js';
import {
  API,
  authHeader,
  createTwoTenants,
  registerBusiness,
} from './support/auth-flows.js';
import { createTestApp } from './support/create-test-app.js';
import { truncateAll } from './support/test-data-source.js';

describe('Authentication (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;

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

  describe('POST /auth/register', () => {
    it('creates the business, the owner and a usable session', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/register`)
        .send({
          businessName: 'Barbería Los Ángeles',
          country: 'PE',
          currency: 'PEN',
          timezone: 'America/Lima',
          ownerName: 'Carlos Ramírez',
          ownerEmail: 'carlos@barberia.pe',
          password: 'unaClaveSegura1',
        })
        .expect(201);

      expect(response.body.data).toMatchObject({
        role: UserRole.Owner,
        expiresIn: 900,
      });
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.refreshToken).toEqual(expect.any(String));
      // Nothing sensitive leaks into the response.
      expect(JSON.stringify(response.body)).not.toContain('unaClaveSegura1');
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });

    it('rejects an email that already has an account', async () => {
      const owner = await registerBusiness(app);

      const response = await request(app.getHttpServer())
        .post(`${API}/auth/register`)
        .send({
          businessName: 'Otra Barbería',
          country: 'PE',
          currency: 'PEN',
          timezone: 'America/Lima',
          ownerName: 'Otro',
          ownerEmail: owner.email,
          password: 'unaClaveSegura1',
        })
        .expect(409);

      expect(response.body.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('rejects a password that is too short', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/register`)
        .send({
          businessName: 'Barbería Corta',
          country: 'PE',
          currency: 'PEN',
          timezone: 'America/Lima',
          ownerName: 'Corta',
          ownerEmail: 'corta@demo.local',
          password: 'corta',
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an unknown time zone', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/register`)
        .send({
          businessName: 'Barbería Atlantis',
          country: 'PE',
          currency: 'PEN',
          timezone: 'America/Atlantis',
          ownerName: 'Atlantis',
          ownerEmail: 'atlantis@demo.local',
          password: 'unaClaveSegura1',
        })
        .expect(400);

      expect(response.body.code).toBe('INVALID_TENANT_DATA');
    });

    it('refuses extra properties, so no client can inject a tenantId', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/register`)
        .send({
          businessName: 'Barbería Maliciosa',
          country: 'PE',
          currency: 'PEN',
          timezone: 'America/Lima',
          ownerName: 'Mal',
          ownerEmail: 'mal@demo.local',
          password: 'unaClaveSegura1',
          tenantId: 'someone-elses-tenant',
        })
        .expect(400);

      expect(response.body.details.errors).toContain(
        'property tenantId should not exist',
      );
    });
  });

  describe('POST /auth/login', () => {
    it('signs in with the email in any case', async () => {
      const owner = await registerBusiness(app, { email: 'ana@demo.local' });

      const response = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'ANA@Demo.Local', password: owner.password })
        .expect(200);

      expect(response.body.data.tenantId).toBe(owner.tenantId);
    });

    it('returns the same error for a wrong password and an unknown email', async () => {
      const owner = await registerBusiness(app);

      const wrongPassword = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: owner.email, password: 'otraClave12345' })
        .expect(401);

      const unknownEmail = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'nadie@demo.local', password: 'otraClave12345' })
        .expect(401);

      // Identical responses: the API cannot be used to enumerate accounts.
      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknownEmail.body.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it('refuses to sign in once the membership is revoked', async () => {
      const owner = await registerBusiness(app);

      await dataSource.query(
        'UPDATE memberships SET status = ? WHERE user_id = ?',
        ['INACTIVE', owner.userId],
      );

      const response = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: owner.email, password: owner.password })
        .expect(403);

      expect(response.body.code).toBe('NO_ACTIVE_MEMBERSHIP');
    });
  });

  describe('GET /auth/me', () => {
    it('describes the caller and their business', async () => {
      const owner = await registerBusiness(app, {
        businessName: 'Barbería Central',
        email: 'central@demo.local',
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set(...authHeader(owner))
        .expect(200);

      expect(response.body.data).toMatchObject({
        user: { id: owner.userId, email: 'central@demo.local' },
        tenant: {
          id: owner.tenantId,
          name: 'Barbería Central',
          timezone: 'America/Lima',
          currency: 'PEN',
        },
        role: UserRole.Owner,
      });
    });

    it('rejects a request with no token', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it.each([
      ['a malformed token', 'Bearer not-a-jwt'],
      ['the wrong scheme', 'Basic dXNlcjpwYXNz'],
      ['an empty bearer', 'Bearer '],
    ])('rejects %s', async (_case, header) => {
      await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set('Authorization', header)
        .expect(401);
    });

    it('stops working the moment the membership is revoked', async () => {
      const owner = await registerBusiness(app);

      await dataSource.query(
        'UPDATE memberships SET status = ? WHERE user_id = ?',
        ['INACTIVE', owner.userId],
      );

      // The access token is still cryptographically valid: what changed is the
      // membership, which the guard re-reads on every request.
      const response = await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set(...authHeader(owner))
        .expect(403);

      expect(response.body.code).toBe('MEMBERSHIP_REVOKED');
    });

    it('stops working the moment the business is suspended', async () => {
      const owner = await registerBusiness(app);

      await dataSource.query('UPDATE tenants SET status = ? WHERE id = ?', [
        'SUSPENDED',
        owner.tenantId,
      ]);

      const response = await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set(...authHeader(owner))
        .expect(403);

      expect(response.body.code).toBe('TENANT_SUSPENDED');
    });

    it('reflects a role change without reissuing the token', async () => {
      const owner = await registerBusiness(app);

      await dataSource.query(
        'UPDATE memberships SET role = ? WHERE user_id = ?',
        [UserRole.Staff, owner.userId],
      );

      const response = await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set(...authHeader(owner))
        .expect(200);

      // The role is read from the membership, never from the token claims.
      expect(response.body.data.role).toBe(UserRole.Staff);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the token and keeps the session usable', async () => {
      const owner = await registerBusiness(app);

      const refreshed = await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: owner.refreshToken })
        .expect(200);

      const newRefreshToken = refreshed.body.data.refreshToken as string;
      expect(newRefreshToken).not.toBe(owner.refreshToken);

      await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${refreshed.body.data.accessToken}`)
        .expect(200);
    });

    it('revokes the whole family when an old token is replayed', async () => {
      const owner = await registerBusiness(app);

      const refreshed = await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: owner.refreshToken })
        .expect(200);

      // Replaying the rotated token means it leaked.
      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: owner.refreshToken })
        .expect(401);

      // ...so even the legitimate new token is dead: sign in again.
      const afterRevocation = await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: refreshed.body.data.refreshToken })
        .expect(401);

      expect(afterRevocation.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('rejects an unknown token', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: 'never-issued' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('ends the session', async () => {
      const owner = await registerBusiness(app);

      await request(app.getHttpServer())
        .post(`${API}/auth/logout`)
        .send({ refreshToken: owner.refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: owner.refreshToken })
        .expect(401);
    });

    it('succeeds for an unknown token, so it cannot be used to probe', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/logout`)
        .send({ refreshToken: 'never-issued' })
        .expect(204);
    });
  });

  describe('tenant isolation', () => {
    it('gives each business its own tenant, users and session', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);

      expect(tenantA.tenantId).not.toBe(tenantB.tenantId);

      const meA = await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set(...authHeader(tenantA))
        .expect(200);

      const meB = await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set(...authHeader(tenantB))
        .expect(200);

      expect(meA.body.data.tenant.id).toBe(tenantA.tenantId);
      expect(meB.body.data.tenant.id).toBe(tenantB.tenantId);
      expect(meA.body.data.tenant.name).toBe('Barbería A');
      expect(meB.body.data.tenant.name).toBe('Barbería B');
    });

    it('does not let a token survive being re-pointed at another tenant', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);

      // Forge the situation an attacker wants: A's membership id presented for
      // B's tenant. The guard looks the membership up *within* the tenant, so
      // it simply does not resolve.
      await dataSource.query(
        'UPDATE memberships SET tenant_id = ? WHERE user_id = ?',
        [tenantB.tenantId, tenantA.userId],
      );

      const response = await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set(...authHeader(tenantA))
        .expect(403);

      expect(response.body.code).toBe('MEMBERSHIP_REVOKED');
    });

    it('keeps refresh tokens bound to their own tenant', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);

      const refreshed = await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: tenantA.refreshToken })
        .expect(200);

      expect(refreshed.body.data.tenantId).toBe(tenantA.tenantId);
      expect(refreshed.body.data.tenantId).not.toBe(tenantB.tenantId);
    });
  });
});
