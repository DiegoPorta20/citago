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

describe('Team (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let owner: RegisteredBusiness;

  const server = () => app.getHttpServer();

  const addMember = (
    body: Record<string, unknown>,
    token: RegisteredBusiness = owner,
  ) =>
    request(server())
      .post(`${API}/users`)
      .set(...authHeader(token))
      .send(body);

  const login = (email: string, password: string) =>
    request(server()).post(`${API}/auth/login`).send({ email, password });

  /** Grants access and signs in as that person. */
  const memberSession = async (
    role: UserRole,
    email: string,
  ): Promise<{ membershipId: string; session: RegisteredBusiness }> => {
    const password = 'unaClaveSegura1';
    const created = await addMember({
      name: 'Nuevo Miembro',
      email,
      role,
      password,
    }).expect(201);

    const signedIn = await login(email, password).expect(200);

    return {
      membershipId: created.body.data.id as string,
      session: { ...signedIn.body.data, email, password },
    };
  };

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

  describe('granting access', () => {
    it('creates the account and returns a temporary password once', async () => {
      const response = await addMember({
        name: 'Luis Torres',
        email: 'luis@demo.local',
        role: UserRole.Staff,
      }).expect(201);

      expect(response.body.data).toMatchObject({
        name: 'Luis Torres',
        email: 'luis@demo.local',
        role: UserRole.Staff,
        status: 'ACTIVE',
      });

      const temporaryPassword = response.body.data.temporaryPassword as string;

      expect(temporaryPassword).toEqual(expect.any(String));

      // It works exactly once as a real password, and is never shown again.
      await login('luis@demo.local', temporaryPassword).expect(200);

      const list = await request(server())
        .get(`${API}/users`)
        .set(...authHeader(owner))
        .expect(200);

      expect(list.body.data).toHaveLength(2);
      expect(list.body.data[1].temporaryPassword).toBeUndefined();
    });

    it('lets the inviter choose the password, and then returns none', async () => {
      const response = await addMember({
        name: 'Ana',
        email: 'ana@demo.local',
        role: UserRole.Admin,
        password: 'unaClaveSegura1',
      }).expect(201);

      expect(response.body.data.temporaryPassword).toBeNull();
      await login('ana@demo.local', 'unaClaveSegura1').expect(200);
    });

    it('refuses the same person twice', async () => {
      await addMember({
        name: 'Luis',
        email: 'luis@demo.local',
        role: UserRole.Staff,
      }).expect(201);

      const response = await addMember({
        name: 'Luis otra vez',
        email: 'luis@demo.local',
        role: UserRole.Staff,
      }).expect(409);

      expect(response.body.code).toBe('USER_ALREADY_IN_TEAM');
    });

    it('rejects a password shorter than the policy', async () => {
      await addMember({
        name: 'Luis',
        email: 'luis@demo.local',
        role: UserRole.Staff,
        password: 'corta',
      }).expect(400);
    });
  });

  describe('changing access', () => {
    it('promotes, revokes and restores', async () => {
      const { membershipId } = await memberSession(
        UserRole.Staff,
        'luis@demo.local',
      );

      const promoted = await request(server())
        .patch(`${API}/users/${membershipId}`)
        .set(...authHeader(owner))
        .send({ role: UserRole.Admin })
        .expect(200);

      expect(promoted.body.data.role).toBe(UserRole.Admin);

      const revoked = await request(server())
        .post(`${API}/users/${membershipId}/revoke`)
        .set(...authHeader(owner))
        .expect(200);

      expect(revoked.body.data.status).toBe('INACTIVE');

      const restored = await request(server())
        .post(`${API}/users/${membershipId}/restore`)
        .set(...authHeader(owner))
        .expect(200);

      expect(restored.body.data.status).toBe('ACTIVE');
    });

    it('closes the door on the next request, not at the next login (rule ID-6)', async () => {
      const { membershipId, session } = await memberSession(
        UserRole.Staff,
        'luis@demo.local',
      );

      await request(server())
        .get(`${API}/auth/me`)
        .set(...authHeader(session))
        .expect(200);

      await request(server())
        .post(`${API}/users/${membershipId}/revoke`)
        .set(...authHeader(owner))
        .expect(200);

      // Same token, still unexpired: the membership is checked every time.
      await request(server())
        .get(`${API}/auth/me`)
        .set(...authHeader(session))
        .expect(403);

      await login(session.email, session.password).expect(403);
    });

    it('never leaves the business without an owner (rule ID-1)', async () => {
      const second = await memberSession(UserRole.Owner, 'ana@demo.local');

      // Two owners: one of them can go.
      const revoked = await request(server())
        .post(`${API}/users/${second.membershipId}/revoke`)
        .set(...authHeader(owner))
        .expect(200);

      expect(revoked.body.data.status).toBe('INACTIVE');

      // The one left cannot be pushed out by anyone: not by themselves
      // (rule ID-7) and not by an ADMIN, who may not touch an owner.
      const admin = await memberSession(UserRole.Admin, 'admin@demo.local');
      const list = await request(server())
        .get(`${API}/users`)
        .set(...authHeader(owner))
        .expect(200);

      const lastOwner = (
        list.body.data as { id: string; role: UserRole; status: string }[]
      ).find((row) => row.role === UserRole.Owner && row.status === 'ACTIVE');

      await request(server())
        .patch(`${API}/users/${lastOwner?.id}`)
        .set(...authHeader(admin.session))
        .send({ role: UserRole.Staff })
        .expect(403);

      await request(server())
        .post(`${API}/users/${lastOwner?.id}/revoke`)
        .set(...authHeader(owner))
        .expect(403);
    });

    it('never lets anyone lock themselves out (rule ID-7)', async () => {
      const list = await request(server())
        .get(`${API}/users`)
        .set(...authHeader(owner))
        .expect(200);

      const own = list.body.data[0] as { id: string };

      const response = await request(server())
        .post(`${API}/users/${own.id}/revoke`)
        .set(...authHeader(owner))
        .expect(403);

      expect(response.body.code).toBe('CANNOT_CHANGE_OWN_ACCESS');
    });
  });

  describe('authorization (docs/permissions.md)', () => {
    it('keeps STAFF out of user management entirely', async () => {
      const { session } = await memberSession(
        UserRole.Staff,
        'luis@demo.local',
      );

      await request(server())
        .get(`${API}/users`)
        .set(...authHeader(session))
        .expect(403);

      await addMember(
        { name: 'X', email: 'x@demo.local', role: UserRole.Staff },
        session,
      ).expect(403);
    });

    it('lets an ADMIN manage staff but never a peer or an owner', async () => {
      const admin = await memberSession(UserRole.Admin, 'ana@demo.local');
      const staff = await memberSession(UserRole.Staff, 'luis@demo.local');

      await addMember(
        { name: 'Otro', email: 'otro@demo.local', role: UserRole.Staff },
        admin.session,
      ).expect(201);

      await addMember(
        { name: 'Jefe', email: 'jefe@demo.local', role: UserRole.Owner },
        admin.session,
      ).expect(403);

      await request(server())
        .post(`${API}/users/${staff.membershipId}/revoke`)
        .set(...authHeader(admin.session))
        .expect(200);

      const list = await request(server())
        .get(`${API}/users`)
        .set(...authHeader(owner))
        .expect(200);

      const ownerRow = (
        list.body.data as { id: string; role: UserRole }[]
      ).find((row) => row.role === UserRole.Owner);

      await request(server())
        .post(`${API}/users/${ownerRow?.id}/revoke`)
        .set(...authHeader(admin.session))
        .expect(403);
    });
  });

  describe('tenant isolation (ADR 0004)', () => {
    it("never shows or touches another business's people", async () => {
      const { membershipId } = await memberSession(
        UserRole.Staff,
        'luis@demo.local',
      );
      const other = await registerBusiness(app);

      const list = await request(server())
        .get(`${API}/users`)
        .set(...authHeader(other))
        .expect(200);

      expect(list.body.data).toHaveLength(1);

      const response = await request(server())
        .post(`${API}/users/${membershipId}/revoke`)
        .set(...authHeader(other))
        .expect(404);

      expect(response.body.code).toBe('MEMBERSHIP_NOT_FOUND');
    });
  });
});
