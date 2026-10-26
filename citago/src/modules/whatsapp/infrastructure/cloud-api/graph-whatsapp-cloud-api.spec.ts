import type { ConfigService } from '@nestjs/config';

import {
  FAKE_APP_ID,
  FAKE_APP_SECRET,
  FakeGraphApi,
  VALID_SIGNUP_CODE,
  VALID_TOKEN,
} from '../../../../../test/support/fake-graph-api.js';
import type { EnvironmentVariables } from '../../../../config/environment.js';
import { WhatsAppApiError } from '../../application/ports/whatsapp-cloud-api.port.js';
import { GraphWhatsAppCloudApi } from './graph-whatsapp-cloud-api.js';

async function failureOf(promise: Promise<unknown>): Promise<WhatsAppApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof WhatsAppApiError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the call to fail.');
}

describe('GraphWhatsAppCloudApi (against a local fake of Meta)', () => {
  const graph = new FakeGraphApi();
  let api: GraphWhatsAppCloudApi;

  const apiFor = (url: string) =>
    new GraphWhatsAppCloudApi({
      get: (key: string) =>
        ({
          WHATSAPP_GRAPH_API_URL: url,
          WHATSAPP_GRAPH_API_VERSION: 'v23.0',
          WHATSAPP_APP_ID: FAKE_APP_ID,
          WHATSAPP_APP_SECRET: FAKE_APP_SECRET,
          ENCRYPTION_KEY: 'pin-key-for-tests',
        })[key],
    } as unknown as ConfigService<EnvironmentVariables, true>);

  beforeAll(async () => {
    api = apiFor(`${await graph.start()}/`);
  });

  afterAll(async () => {
    await graph.stop();
  });

  beforeEach(() => graph.reset());

  it('reads the phone number with the token as a bearer header', async () => {
    const info = await api.getPhoneNumber('1234567890', VALID_TOKEN);

    expect(info).toEqual({
      displayPhoneNumber: '+51 1 555 0000',
      verifiedName: 'Barbería Test',
    });
    expect(graph.requests[0]).toMatchObject({
      method: 'GET',
      path: '/v23.0/1234567890',
      authorization: `Bearer ${VALID_TOKEN}`,
    });
  });

  it('sends a text to the number without "+", and returns the wamid', async () => {
    const id = await api.sendText({
      phoneNumberId: '1234567890',
      accessToken: VALID_TOKEN,
      to: '+51999999999',
      body: 'Hola',
    });

    expect(id).toMatch(/^wamid\./);
    expect(graph.sentMessages[0].body).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '51999999999',
      type: 'text',
      text: { body: 'Hola', preview_url: false },
    });
  });

  it.each([
    [{ status: 401, code: 190 }, 'UNAUTHORIZED'],
    [{ status: 400, code: 131047 }, 'WINDOW_CLOSED'],
    [{ status: 400, code: 100 }, 'REJECTED'],
    [{ status: 429, code: 130429 }, 'UNAVAILABLE'],
    [{ status: 400, code: 80007 }, 'UNAVAILABLE'],
    [{ status: 503 }, 'UNAVAILABLE'],
  ] as const)('maps %j to %s', async (failure, expected) => {
    graph.failNext(failure);

    const error = await failureOf(
      api.sendText({
        phoneNumberId: '1234567890',
        accessToken: VALID_TOKEN,
        to: '+51999999999',
        body: 'Hola',
      }),
    );

    expect(error.failure).toBe(expected);
  });

  it('treats an invalid token as UNAUTHORIZED and never echoes it', async () => {
    const error = await failureOf(
      api.getPhoneNumber('1234567890', 'EAAG-some-revoked-token'),
    );

    expect(error.failure).toBe('UNAUTHORIZED');
    expect(error.message).not.toContain('EAAG-some-revoked-token');
  });

  it('refuses a non-numeric id without making a request', async () => {
    const error = await failureOf(api.getPhoneNumber('../../me', VALID_TOKEN));

    expect(error.failure).toBe('REJECTED');
    expect(graph.requests).toHaveLength(0);
  });

  it('reports an unreachable Meta as UNAVAILABLE', async () => {
    const unreachable = apiFor('http://127.0.0.1:9');

    const error = await failureOf(
      unreachable.getPhoneNumber('1234567890', VALID_TOKEN),
    );

    expect(error.failure).toBe('UNAVAILABLE');
  });

  describe('Embedded Signup calls', () => {
    it('trades the code for a token with the app id and secret, no bearer', async () => {
      const token = await api.exchangeCode(VALID_SIGNUP_CODE);

      expect(token).toBe(VALID_TOKEN);
      expect(graph.requests[0]).toMatchObject({
        method: 'GET',
        path: '/v23.0/oauth/access_token',
        authorization: undefined,
        query: {
          client_id: FAKE_APP_ID,
          client_secret: FAKE_APP_SECRET,
          code: VALID_SIGNUP_CODE,
        },
      });
    });

    it('rejects an expired or reused code', async () => {
      const error = await failureOf(api.exchangeCode('used-code'));

      expect(error.failure).toBe('REJECTED');
      expect(error.message).not.toContain(FAKE_APP_SECRET);
    });

    it('subscribes the app to the account with the customer token', async () => {
      await api.subscribeApp('102290129340398', VALID_TOKEN);

      expect(graph.requests[0]).toMatchObject({
        method: 'POST',
        path: '/v23.0/102290129340398/subscribed_apps',
        authorization: `Bearer ${VALID_TOKEN}`,
      });
    });

    it('registers the number with a 6-digit PIN that is stable per number', async () => {
      await api.registerPhone('1234567890', VALID_TOKEN);
      await api.registerPhone('1234567890', VALID_TOKEN);
      await api.registerPhone('1234567891', VALID_TOKEN);

      const pins = graph.requests.map(
        (request) => (request.body as { pin: string }).pin,
      );

      expect(graph.requests[0]).toMatchObject({
        method: 'POST',
        path: '/v23.0/1234567890/register',
        body: { messaging_product: 'whatsapp' },
      });
      expect(pins[0]).toMatch(/^\d{6}$/);
      expect(pins[1]).toBe(pins[0]);
      expect(pins[2]).not.toBe(pins[0]);
    });

    it('refuses a non-numeric account id without making a request', async () => {
      const error = await failureOf(api.subscribeApp('../me', VALID_TOKEN));

      expect(error.failure).toBe('REJECTED');
      expect(graph.requests).toHaveLength(0);
    });
  });
});
