import { createHmac } from 'node:crypto';

import { getDataSourceToken } from '@nestjs/typeorm';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';

import { addStaffUser } from './support/agenda-fixtures.js';
import {
  API,
  authHeader,
  createTwoTenants,
  registerBusiness,
  type RegisteredBusiness,
} from './support/auth-flows.js';
import { createTestApp } from './support/create-test-app.js';
import { FakeGraphApi, VALID_TOKEN } from './support/fake-graph-api.js';
import { queryRows, truncateAll } from './support/test-data-source.js';

/** Must match WHATSAPP_GRAPH_API_URL and WHATSAPP_APP_SECRET in .env.test. */
const GRAPH_PORT = 3399;
const APP_SECRET = 'test-app-secret';
const VERIFY_TOKEN = 'test-verify-token';

const NUMBER_A = '106540352242922';
const NUMBER_B = '106540352242999';

let messageSequence = 0;

/** A Meta webhook with one text message per entry of `messages`. */
function metaWebhook(
  phoneNumberId: string,
  messages: { from?: string; id?: string; body?: string; name?: string }[],
): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '102290129340398',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550000000',
                phone_number_id: phoneNumberId,
              },
              contacts: messages.map((m) => ({
                profile: { name: m.name ?? 'Juan' },
                wa_id: m.from ?? '51999999999',
              })),
              messages: messages.map((m) => {
                messageSequence += 1;

                return {
                  from: m.from ?? '51999999999',
                  id: m.id ?? `wamid.e2e-${messageSequence}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: m.body ?? 'Hola, ¿hay turno?' },
                };
              }),
            },
          },
        ],
      },
    ],
  });
}

const sign = (body: string, secret = APP_SECRET) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('WhatsApp (e2e)', () => {
  const graph = new FakeGraphApi();
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let owner: RegisteredBusiness;

  const server = () => app.getHttpServer();

  const connect = (
    business: RegisteredBusiness,
    body: Record<string, unknown> = {},
  ) =>
    request(server())
      .put(`${API}/whatsapp/channel`)
      .set(...authHeader(business))
      .send({ phoneNumberId: NUMBER_A, accessToken: VALID_TOKEN, ...body });

  const deliver = (body: string, signature: string | null = sign(body)) => {
    const call = request(server())
      .post(`${API}/webhooks/whatsapp`)
      .set('Content-Type', 'application/json');

    return (signature ? call.set('X-Hub-Signature-256', signature) : call).send(
      body,
    );
  };

  const inbox = (business: RegisteredBusiness) =>
    request(server())
      .get(`${API}/conversations`)
      .set(...authHeader(business));

  const reply = (
    business: RegisteredBusiness,
    conversationId: string,
    body = 'Sí, a las 10 está libre.',
  ) =>
    request(server())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(...authHeader(business))
      .send({ body });

  const countMessages = async () =>
    (
      await queryRows<{ total: string }>(
        dataSource,
        'SELECT COUNT(*) AS total FROM messages',
      )
    )[0].total;

  beforeAll(async () => {
    await graph.start(GRAPH_PORT);
    app = await createTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());
    await dataSource.runMigrations({ transaction: 'all' });
  }, 90_000);

  beforeEach(async () => {
    await truncateAll(dataSource);
    graph.reset();
    owner = await registerBusiness(app);
  });

  afterAll(async () => {
    await app?.close();
    await graph.stop();
  });

  describe('channel connection', () => {
    it('starts disconnected', async () => {
      const response = await request(server())
        .get(`${API}/whatsapp/channel`)
        .set(...authHeader(owner))
        .expect(200);

      expect(response.body.data).toMatchObject({
        connected: false,
        phoneNumberId: null,
      });
    });

    it('checks the credentials with Meta, then stores the token encrypted', async () => {
      const response = await connect(owner, {
        wabaId: '102290129340398',
      }).expect(200);

      expect(response.body.data).toMatchObject({
        connected: true,
        phoneNumberId: NUMBER_A,
        wabaId: '102290129340398',
        displayPhoneNumber: '+51 1 555 0000',
        verifiedName: 'Barbería Test',
      });
      expect(JSON.stringify(response.body)).not.toContain(VALID_TOKEN);
      expect(graph.requests[0]).toMatchObject({
        method: 'GET',
        path: `/v23.0/${NUMBER_A}`,
      });

      const [row] = await queryRows<{ token: Buffer }>(
        dataSource,
        'SELECT encrypted_access_token AS token FROM whatsapp_channels WHERE tenant_id = ?',
        [owner.tenantId],
      );

      expect(row.token.toString('latin1')).not.toContain(VALID_TOKEN);
      expect(row.token.length).toBeGreaterThan(VALID_TOKEN.length);
    });

    it('stores nothing when Meta rejects the token', async () => {
      const response = await connect(owner, {
        accessToken: 'EAAG-revoked-token-00000000000',
      }).expect(422);

      expect(response.body.code).toBe('WHATSAPP_CREDENTIALS_REJECTED');
      expect(
        await queryRows(dataSource, 'SELECT id FROM whatsapp_channels'),
      ).toHaveLength(0);
    });

    it('answers 502 when Meta is down', async () => {
      graph.failNext({ status: 503 });

      const response = await connect(owner).expect(502);

      expect(response.body.code).toBe('WHATSAPP_UNAVAILABLE');
    });

    it('does not let a second business claim a connected number', async () => {
      const other = await registerBusiness(app);

      await connect(owner).expect(200);
      const response = await connect(other).expect(409);

      expect(response.body.code).toBe('WHATSAPP_NUMBER_IN_USE');
    });

    it('replaces the connection when connecting again', async () => {
      await connect(owner).expect(200);
      await connect(owner, { phoneNumberId: NUMBER_B }).expect(200);

      const rows = await queryRows<{ phone: string }>(
        dataSource,
        'SELECT phone_number_id AS phone FROM whatsapp_channels',
      );

      expect(rows).toEqual([{ phone: NUMBER_B }]);
    });

    it('disconnects, deleting the token and keeping the conversations', async () => {
      await connect(owner).expect(200);
      await deliver(metaWebhook(NUMBER_A, [{}])).expect(200);

      await request(server())
        .delete(`${API}/whatsapp/channel`)
        .set(...authHeader(owner))
        .expect(204);

      expect(
        await queryRows(dataSource, 'SELECT id FROM whatsapp_channels'),
      ).toHaveLength(0);
      expect((await inbox(owner)).body.data).toHaveLength(1);
    });

    it('validates the input and refuses a tenantId', async () => {
      await connect(owner, { phoneNumberId: '../me' }).expect(400);
      await connect(owner, { tenantId: owner.tenantId }).expect(400);
      expect(graph.requests).toHaveLength(0);
    });

    it('is for OWNER and ADMIN only', async () => {
      const { staffUser } = await addStaffUser(app, owner);

      await connect(staffUser).expect(403);
      await request(server())
        .get(`${API}/whatsapp/channel`)
        .set(...authHeader(staffUser))
        .expect(403);
    });
  });

  describe('webhook', () => {
    beforeEach(async () => {
      await connect(owner).expect(200);
    });

    it('answers the subscription challenge with the right verify token', async () => {
      const response = await request(server())
        .get(`${API}/webhooks/whatsapp`)
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': '1158201444',
        })
        .expect(200);

      expect(response.text).toBe('1158201444');
      expect(response.headers['content-type']).toMatch(/text\/plain/);
    });

    it('refuses the challenge with a wrong verify token', async () => {
      await request(server())
        .get(`${API}/webhooks/whatsapp`)
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'guess',
          'hub.challenge': '1158201444',
        })
        .expect(403);
    });

    it.each([
      ['no signature', null],
      ['a signature with another secret', 'other-secret'],
    ])(
      'rejects a delivery with %s and stores nothing',
      async (_label, secret) => {
        const body = metaWebhook(NUMBER_A, [{}]);
        const response = await deliver(
          body,
          secret === null ? null : sign(body, secret),
        ).expect(401);

        expect(response.body.code).toBe('INVALID_SIGNATURE');
        expect(await countMessages()).toBe('0');
      },
    );

    it('rejects a body altered after signing', async () => {
      const body = metaWebhook(NUMBER_A, [{ body: 'original' }]);

      await deliver(body.replace('original', 'tampered'), sign(body)).expect(
        401,
      );
    });

    it('records the message in the business that owns the number', async () => {
      const client = await request(server())
        .post(`${API}/clients`)
        .set(...authHeader(owner))
        .send({ name: 'Juan Pérez', phone: '999 999 999' })
        .expect(201);

      const response = await deliver(
        metaWebhook(NUMBER_A, [{ body: '¿Tienen turno mañana?' }]),
      ).expect(200);

      expect(response.body.data).toEqual({
        recorded: 1,
        duplicates: 0,
        ignored: 0,
      });

      const [conversation] = (await inbox(owner)).body.data;

      expect(conversation).toMatchObject({
        channel: 'WHATSAPP',
        contactIdentifier: '+51999999999',
        contactName: 'Juan',
        needsReply: true,
        lastMessagePreview: '¿Tienen turno mañana?',
        client: { id: client.body.data.id },
      });
    });

    it('stores a message delivered twice only once', async () => {
      const body = metaWebhook(NUMBER_A, [{ id: 'wamid.repeated' }]);

      await deliver(body).expect(200);
      const second = await deliver(body).expect(200);

      expect(second.body.data).toEqual({
        recorded: 0,
        duplicates: 1,
        ignored: 0,
      });
      expect(await countMessages()).toBe('1');
    });

    it('acknowledges but ignores a number no business has connected', async () => {
      const response = await deliver(
        metaWebhook('999999999999999', [{}]),
      ).expect(200);

      expect(response.body.data).toEqual({
        recorded: 0,
        duplicates: 0,
        ignored: 1,
      });
      expect(await countMessages()).toBe('0');
    });

    it('acknowledges receipts and foreign payloads without storing anything', async () => {
      const receipts = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: NUMBER_A },
                  statuses: [{ id: 'wamid.x', status: 'delivered' }],
                },
              },
            ],
          },
        ],
      });

      await deliver(receipts).expect(200);
      await deliver(JSON.stringify({ object: 'page' })).expect(200);
      expect(await countMessages()).toBe('0');
    });

    it('routes each number to its own business only', async () => {
      const other = await registerBusiness(app);

      await connect(other, { phoneNumberId: NUMBER_B }).expect(200);

      await deliver(
        metaWebhook(NUMBER_A, [{ from: '51911111111', body: 'para A' }]),
      ).expect(200);
      await deliver(
        metaWebhook(NUMBER_B, [{ from: '51922222222', body: 'para B' }]),
      ).expect(200);

      const inboxA = (await inbox(owner)).body.data;
      const inboxB = (await inbox(other)).body.data;

      expect(inboxA).toHaveLength(1);
      expect(inboxA[0].lastMessagePreview).toBe('para A');
      expect(inboxB).toHaveLength(1);
      expect(inboxB[0].lastMessagePreview).toBe('para B');
    });
  });

  describe('replying', () => {
    let conversationId: string;

    beforeEach(async () => {
      await connect(owner).expect(200);
      await deliver(metaWebhook(NUMBER_A, [{}])).expect(200);
      conversationId = (await inbox(owner)).body.data[0].id;
      graph.reset();
    });

    it('sends through Meta, records the reply and clears the pending flag', async () => {
      const response = await reply(owner, conversationId).expect(201);

      expect(response.body.data).toMatchObject({
        direction: 'OUTBOUND',
        type: 'TEXT',
        body: 'Sí, a las 10 está libre.',
        authorUserId: owner.userId,
      });
      expect(graph.sentMessages).toHaveLength(1);
      expect(graph.sentMessages[0]).toMatchObject({
        path: `/v23.0/${NUMBER_A}/messages`,
        authorization: `Bearer ${VALID_TOKEN}`,
        body: { to: '51999999999', text: { body: 'Sí, a las 10 está libre.' } },
      });

      const [conversation] = (await inbox(owner)).body.data;

      expect(conversation.needsReply).toBe(false);

      const [stored] = await queryRows<{ external: string }>(
        dataSource,
        "SELECT external_message_id AS external FROM messages WHERE direction = 'OUTBOUND'",
      );

      expect(stored.external).toMatch(/^wamid\.fake-/);
    });

    it('lets STAFF answer too', async () => {
      const { staffUser } = await addStaffUser(app, owner);

      await reply(staffUser, conversationId).expect(201);
    });

    it('refuses once 24 hours have passed since the client wrote, without calling Meta', async () => {
      await dataSource.query(
        'UPDATE conversations SET last_inbound_at = ? WHERE id = ?',
        [new Date(Date.now() - 25 * 60 * 60 * 1000), conversationId],
      );

      const response = await reply(owner, conversationId).expect(422);

      expect(response.body.code).toBe('REPLY_WINDOW_CLOSED');
      expect(graph.sentMessages).toHaveLength(0);
    });

    it('reports Meta closing the window as REPLY_WINDOW_CLOSED', async () => {
      graph.failNext({ status: 400, code: 131047 });

      const response = await reply(owner, conversationId).expect(422);

      expect(response.body.code).toBe('REPLY_WINDOW_CLOSED');
    });

    it('records nothing when Meta fails', async () => {
      graph.failNext({ status: 503 });

      const response = await reply(owner, conversationId).expect(502);

      expect(response.body).toMatchObject({
        code: 'MESSAGE_DELIVERY_FAILED',
        details: { reason: 'UNAVAILABLE' },
      });
      expect(await countMessages()).toBe('1');
    });

    it('asks to reconnect when the stored token stopped working', async () => {
      graph.failNext({ status: 401, code: 190 });

      const response = await reply(owner, conversationId).expect(502);

      expect(response.body.details).toEqual({ reason: 'CHANNEL_AUTH' });
    });

    it('needs a connected channel', async () => {
      await request(server())
        .delete(`${API}/whatsapp/channel`)
        .set(...authHeader(owner))
        .expect(204);

      const response = await reply(owner, conversationId).expect(422);

      expect(response.body.code).toBe('CHANNEL_NOT_CONNECTED');
    });

    it('validates the text before sending', async () => {
      await reply(owner, conversationId, '').expect(400);
      await reply(owner, conversationId, '   ').expect(400);
      await reply(owner, conversationId, 'x'.repeat(4097)).expect(400);
      expect(graph.sentMessages).toHaveLength(0);
    });

    it("never replies in another business's conversation", async () => {
      const { tenantB } = await createTwoTenants(app);

      await reply(tenantB, conversationId).expect(404);
      expect(graph.sentMessages).toHaveLength(0);
    });
  });
});
