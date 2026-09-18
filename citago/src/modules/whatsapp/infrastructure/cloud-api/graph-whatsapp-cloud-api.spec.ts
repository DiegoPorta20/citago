import type { ConfigService } from '@nestjs/config';

import {
  FakeGraphApi,
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
      get: (key: string) => (key === 'WHATSAPP_GRAPH_API_URL' ? url : 'v23.0'),
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
});
