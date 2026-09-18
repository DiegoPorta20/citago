import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

export const VALID_TOKEN = 'EAAG-valid-test-token-0123456789';

export interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | undefined;
  readonly body: unknown;
}

export interface ForcedFailure {
  readonly status: number;
  /** Meta error code; omitted for a bare HTTP failure. */
  readonly code?: number;
}

/**
 * A stand-in for Meta's Graph API, served over real HTTP so the actual adapter
 * (fetch, headers, JSON, error mapping) is what gets tested.
 *
 * - `GET /{version}/{phoneNumberId}` answers for {@link VALID_TOKEN} only;
 *   any other token gets Meta's "invalid token" error (190).
 * - `POST /{version}/{phoneNumberId}/messages` returns a fresh `wamid`.
 * - `failNext` makes the next request fail the way Meta would.
 */
export class FakeGraphApi {
  readonly requests: RecordedRequest[] = [];
  private server: Server | null = null;
  private forced: ForcedFailure | null = null;
  private sent = 0;

  async start(port = 0): Promise<string> {
    this.server = createServer((request, response) => {
      void this.handle(request, response);
    });

    await new Promise<void>((resolve) =>
      this.server?.listen(port, '127.0.0.1', resolve),
    );

    const address = this.server.address() as AddressInfo;

    return `http://127.0.0.1:${address.port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => resolve());
      this.server.closeAllConnections();
    });
  }

  reset(): void {
    this.requests.length = 0;
    this.forced = null;
  }

  failNext(failure: ForcedFailure): void {
    this.forced = failure;
  }

  get sentMessages(): RecordedRequest[] {
    return this.requests.filter(
      (request) =>
        request.method === 'POST' && request.path.endsWith('/messages'),
    );
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
      chunks.push(chunk as Buffer);
    }

    const raw = Buffer.concat(chunks).toString('utf8');
    const url = new URL(request.url ?? '/', 'http://localhost');
    const authorization = request.headers.authorization;

    this.requests.push({
      method: request.method ?? 'GET',
      path: url.pathname,
      authorization,
      body: raw ? (JSON.parse(raw) as unknown) : null,
    });

    if (this.forced) {
      const { status, code } = this.forced;

      this.forced = null;
      reply(response, status, {
        error: { message: 'Forced failure', code: code ?? 1 },
      });
      return;
    }

    if (authorization !== `Bearer ${VALID_TOKEN}`) {
      reply(response, 401, {
        error: { message: 'Invalid OAuth access token.', code: 190 },
      });
      return;
    }

    const [, , phoneNumberId, action] = url.pathname.split('/');

    if (request.method === 'GET' && !action) {
      reply(response, 200, {
        id: phoneNumberId,
        display_phone_number: '+51 1 555 0000',
        verified_name: 'Barbería Test',
      });
      return;
    }

    if (request.method === 'POST' && action === 'messages') {
      this.sent += 1;
      reply(response, 200, {
        messaging_product: 'whatsapp',
        messages: [{ id: `wamid.fake-${Date.now()}-${this.sent}` }],
      });
      return;
    }

    reply(response, 404, { error: { message: 'Unknown path', code: 100 } });
  }
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}
