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

describe('Conversations (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let owner: RegisteredBusiness;

  const server = () => app.getHttpServer();

  const simulate = (
    business: RegisteredBusiness,
    body: Record<string, unknown>,
  ) =>
    request(server())
      .post(`${API}/conversations/simulate-inbound`)
      .set(...authHeader(business))
      .send({ phone: '999 999 999', name: 'Juan', body: 'Hola', ...body });

  const inbox = (
    business: RegisteredBusiness,
    query: Record<string, string> = {},
  ) =>
    request(server())
      .get(`${API}/conversations`)
      .query(query)
      .set(...authHeader(business));

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

  describe('inbound messages', () => {
    it('opens a pending conversation, with the phone normalized', async () => {
      const result = await simulate(owner, {
        body: '¿Tienen turno mañana a las 10?',
      }).expect(200);

      expect(result.body.data.outcome).toBe('recorded');

      const response = await inbox(owner).expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        channel: 'WHATSAPP',
        contactIdentifier: '+51999999999',
        contactName: 'Juan',
        status: 'OPEN',
        needsReply: true,
        client: null,
        lastMessagePreview: '¿Tienen turno mañana a las 10?',
      });
    });

    it('ignores a duplicate delivery (rule CO-2)', async () => {
      await simulate(owner, { externalMessageId: 'wamid.ABC' }).expect(200);

      const duplicate = await simulate(owner, {
        externalMessageId: 'wamid.ABC',
      }).expect(200);

      expect(duplicate.body.data.outcome).toBe('duplicate');

      const conversation = (await inbox(owner)).body.data[0] as { id: string };
      const messages = await request(server())
        .get(`${API}/conversations/${conversation.id}/messages`)
        .set(...authHeader(owner))
        .expect(200);

      expect(messages.body.data).toHaveLength(1);
    });

    it('links the conversation when the phone is already a client', async () => {
      const client = await request(server())
        .post(`${API}/clients`)
        .set(...authHeader(owner))
        .send({ name: 'Juan Pérez', phone: '+51 999 999 999' })
        .expect(201);

      await simulate(owner, {}).expect(200);

      const response = await inbox(owner).expect(200);

      expect(response.body.data[0].client).toEqual({
        id: client.body.data.id,
        name: 'Juan Pérez',
      });
    });
  });

  describe('messages', () => {
    it('pages through the history newest first with a cursor', async () => {
      const base = Date.parse('2026-09-17T15:00:00.000Z');

      for (let index = 0; index < 5; index += 1) {
        await simulate(owner, {
          body: `mensaje ${index}`,
          sentAt: new Date(base + index * 60_000).toISOString(),
        }).expect(200);
      }

      const conversationId = (await inbox(owner)).body.data[0].id as string;
      const page = (before?: string) =>
        request(server())
          .get(`${API}/conversations/${conversationId}/messages`)
          .query({ limit: '2', ...(before ? { before } : {}) })
          .set(...authHeader(owner))
          .expect(200);

      const first = await page();
      expect(
        (first.body.data as { body: string }[]).map((m) => m.body),
      ).toEqual(['mensaje 4', 'mensaje 3']);
      expect(first.body.meta.hasMore).toBe(true);

      const second = await page(first.body.meta.nextBefore as string);
      expect(
        (second.body.data as { body: string }[]).map((m) => m.body),
      ).toEqual(['mensaje 2', 'mensaje 1']);

      const last = await page(second.body.meta.nextBefore as string);
      expect((last.body.data as { body: string }[]).map((m) => m.body)).toEqual(
        ['mensaje 0'],
      );
      expect(last.body.meta).toEqual({ hasMore: false, nextBefore: null });
    });
  });

  describe('handling', () => {
    let conversationId: string;

    beforeEach(async () => {
      await simulate(owner, {}).expect(200);
      conversationId = (await inbox(owner)).body.data[0].id as string;
    });

    it('resolving clears the pending counter', async () => {
      await request(server())
        .post(`${API}/conversations/${conversationId}/resolve`)
        .set(...authHeader(owner))
        .expect(200);

      const pending = await inbox(owner, { needsReply: 'true' }).expect(200);

      expect(pending.body.meta.total).toBe(0);
    });

    it('archiving hides it until the client writes again', async () => {
      const archived = await request(server())
        .post(`${API}/conversations/${conversationId}/archive`)
        .set(...authHeader(owner))
        .expect(200);
      expect(archived.body.data).toMatchObject({
        status: 'ARCHIVED',
        needsReply: false,
      });

      expect((await inbox(owner, { status: 'OPEN' })).body.meta.total).toBe(0);

      await simulate(owner, { body: '¿Sigue en pie?' }).expect(200);

      const reopened = await inbox(owner, { status: 'OPEN' }).expect(200);
      expect(reopened.body.data[0]).toMatchObject({
        id: conversationId,
        needsReply: true,
      });
    });

    it('links and unlinks a client by hand', async () => {
      const client = await request(server())
        .post(`${API}/clients`)
        .set(...authHeader(owner))
        .send({ name: 'Juan Pérez' })
        .expect(201);

      const linked = await request(server())
        .put(`${API}/conversations/${conversationId}/client`)
        .set(...authHeader(owner))
        .send({ clientId: client.body.data.id })
        .expect(200);
      expect(linked.body.data.client.name).toBe('Juan Pérez');

      const unlinked = await request(server())
        .put(`${API}/conversations/${conversationId}/client`)
        .set(...authHeader(owner))
        .send({ clientId: null })
        .expect(200);
      expect(unlinked.body.data.client).toBeNull();
    });

    it('assigns to a member and refuses an outsider', async () => {
      const assigned = await request(server())
        .put(`${API}/conversations/${conversationId}/assignee`)
        .set(...authHeader(owner))
        .send({ userId: owner.userId })
        .expect(200);
      expect(assigned.body.data.assignedUserId).toBe(owner.userId);

      const mine = await inbox(owner, { assignedUserId: owner.userId });
      expect(mine.body.meta.total).toBe(1);

      const stranger = await registerBusiness(app);
      const refused = await request(server())
        .put(`${API}/conversations/${conversationId}/assignee`)
        .set(...authHeader(owner))
        .send({ userId: stranger.userId })
        .expect(422);
      expect(refused.body.code).toBe('ASSIGNEE_NOT_MEMBER');
    });

    it('lets STAFF answer and link, but not archive or assign', async () => {
      await dataSource.query(
        'UPDATE memberships SET role = ? WHERE user_id = ?',
        [UserRole.Staff, owner.userId],
      );

      await request(server())
        .post(`${API}/conversations/${conversationId}/resolve`)
        .set(...authHeader(owner))
        .expect(200);

      await request(server())
        .post(`${API}/conversations/${conversationId}/archive`)
        .set(...authHeader(owner))
        .expect(403);

      await request(server())
        .put(`${API}/conversations/${conversationId}/assignee`)
        .set(...authHeader(owner))
        .send({ userId: owner.userId })
        .expect(403);
    });
  });

  describe('tenant isolation', () => {
    it('keeps each inbox private and answers 404 across tenants', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);
      await simulate(tenantA, {}).expect(200);
      const conversationId = (await inbox(tenantA)).body.data[0].id as string;

      expect((await inbox(tenantB)).body.meta.total).toBe(0);

      // Built one at a time: supertest starts the server per request, and
      // creating several up front makes them race for the listener.
      const calls = [
        () => request(server()).get(`${API}/conversations/${conversationId}`),
        () =>
          request(server()).get(
            `${API}/conversations/${conversationId}/messages`,
          ),
        () =>
          request(server()).post(
            `${API}/conversations/${conversationId}/resolve`,
          ),
      ];

      for (const call of calls) {
        await call()
          .set(...authHeader(tenantB))
          .expect(404);
      }
    });

    it('does not let a conversation be linked to another tenant client', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);
      await simulate(tenantA, {}).expect(200);
      const conversationId = (await inbox(tenantA)).body.data[0].id as string;

      const foreignClient = await request(server())
        .post(`${API}/clients`)
        .set(...authHeader(tenantB))
        .send({ name: 'Cliente de B' })
        .expect(201);

      const response = await request(server())
        .put(`${API}/conversations/${conversationId}/client`)
        .set(...authHeader(tenantA))
        .send({ clientId: foreignClient.body.data.id })
        .expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('keeps the same phone as separate conversations in separate businesses', async () => {
      const { tenantA, tenantB } = await createTwoTenants(app);

      await simulate(tenantA, { body: 'para A' }).expect(200);
      await simulate(tenantB, { body: 'para B' }).expect(200);

      expect((await inbox(tenantA)).body.data[0].lastMessagePreview).toBe(
        'para A',
      );
      expect((await inbox(tenantB)).body.data[0].lastMessagePreview).toBe(
        'para B',
      );
    });
  });
});
