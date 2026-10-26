import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

export const FAKE_CULQI_SECRET = 'sk_test_fake_secret';
export const FAKE_CULQI_PUBLIC = 'pk_test_fake_public';
export const CARD_OK = 'tkn_test_ok';
export const CARD_DECLINED = 'tkn_test_declined';

const DAY_SECONDS = 24 * 60 * 60;

export interface CulqiCall {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | undefined;
  readonly body: Record<string, unknown> | null;
}

interface RemoteSubscription {
  id: string;
  planId: string;
  cardId: string;
  nextBillingDate: number;
  canceled: boolean;
  metadata: unknown;
}

/**
 * A stand-in for Culqi's REST API that behaves the way the adapter's notes
 * assume (see culqi-payment-provider.ts). It proves our side of the contract;
 * it cannot prove Culqi's. Time is in the test's hands: `renew()` moves a
 * subscription's next charge forward the way a successful monthly charge does.
 */
export class FakeCulqiApi {
  readonly calls: CulqiCall[] = [];
  private server: Server | null = null;
  private forced: { status: number; body?: unknown } | null = null;
  private sequence = 0;
  private readonly customers = new Map<string, string>();
  private readonly subscriptions = new Map<string, RemoteSubscription>();

  async start(port = 0): Promise<string> {
    this.server = createServer((request, response) => {
      void this.handle(request, response);
    });
    await new Promise<void>((resolve) =>
      this.server?.listen(port, '127.0.0.1', resolve),
    );

    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
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
    this.calls.length = 0;
    this.forced = null;
    this.customers.clear();
    this.subscriptions.clear();
  }

  failNext(status: number, body?: unknown): void {
    this.forced = { status, body };
  }

  get subscriptionIds(): string[] {
    return [...this.subscriptions.keys()];
  }

  /** The monthly charge succeeded: the next one is a period further on. */
  renew(id: string, days = 30): void {
    const subscription = this.require(id);

    subscription.nextBillingDate += days * DAY_SECONDS;
  }

  isCanceled(id: string): boolean {
    return this.subscriptions.get(id)?.canceled ?? true;
  }

  nextBillingDate(id: string): number {
    return this.require(id).nextBillingDate;
  }

  private require(id: string): RemoteSubscription {
    const subscription = this.subscriptions.get(id);

    if (!subscription) {
      throw new Error(`Unknown fake subscription ${id}`);
    }

    return subscription;
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
    const method = request.method ?? 'GET';
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;

    this.calls.push({
      method,
      path: `${url.pathname}${url.search}`,
      authorization: request.headers.authorization,
      body,
    });

    if (this.forced) {
      const { status, body: forcedBody } = this.forced;

      this.forced = null;
      reply(
        response,
        status,
        forcedBody ?? { object: 'error', type: 'api_error' },
      );
      return;
    }

    if (request.headers.authorization !== `Bearer ${FAKE_CULQI_SECRET}`) {
      reply(response, 401, { object: 'error', type: 'authentication_error' });
      return;
    }

    const [, , resource, id] = url.pathname.split('/');

    if (resource === 'customers') {
      this.customersRoute(method, url, body, response);
      return;
    }
    if (resource === 'cards' && method === 'POST') {
      this.createCard(body, response);
      return;
    }
    if (resource === 'subscriptions') {
      this.subscriptionsRoute(method, id, body, response);
      return;
    }

    reply(response, 404, { object: 'error', type: 'not_found' });
  }

  private customersRoute(
    method: string,
    url: URL,
    body: Record<string, unknown> | null,
    response: ServerResponse,
  ): void {
    if (method === 'GET') {
      const id = this.customers.get(url.searchParams.get('email') ?? '');

      reply(response, 200, { data: id ? [{ id }] : [] });
      return;
    }

    const email = String(body?.email ?? '');
    const required = [
      'first_name',
      'last_name',
      'email',
      'address',
      'address_city',
      'country_code',
      'phone_number',
    ];

    if (required.some((field) => !body?.[field])) {
      reply(response, 400, {
        object: 'error',
        type: 'parameter_error',
        user_message: 'Faltan datos del cliente.',
      });
      return;
    }
    if (this.customers.has(email)) {
      reply(response, 400, {
        object: 'error',
        type: 'parameter_error',
        code: 'duplicado',
      });
      return;
    }

    this.sequence += 1;

    const id = `cus_test_${this.sequence}`;

    this.customers.set(email, id);
    reply(response, 201, { object: 'customer', id });
  }

  private createCard(
    body: Record<string, unknown> | null,
    response: ServerResponse,
  ): void {
    const token = String(body?.token_id ?? '');

    if (token === CARD_DECLINED) {
      reply(response, 400, {
        object: 'error',
        type: 'card_error',
        user_message: 'La tarjeta fue rechazada por el banco.',
      });
      return;
    }
    if (token !== CARD_OK) {
      reply(response, 400, {
        object: 'error',
        type: 'parameter_error',
        user_message: 'El token no es válido.',
      });
      return;
    }

    this.sequence += 1;
    reply(response, 201, { object: 'card', id: `crd_test_${this.sequence}` });
  }

  private subscriptionsRoute(
    method: string,
    id: string | undefined,
    body: Record<string, unknown> | null,
    response: ServerResponse,
  ): void {
    if (method === 'POST') {
      this.sequence += 1;

      const created: RemoteSubscription = {
        id: `sxn_test_${this.sequence}`,
        planId: String(body?.plan_id),
        cardId: String(body?.card_id),
        nextBillingDate: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
        canceled: false,
        metadata: body?.metadata,
      };

      this.subscriptions.set(created.id, created);
      reply(response, 201, publicView(created));
      return;
    }

    const subscription = id ? this.subscriptions.get(id) : undefined;

    if (!subscription || (subscription.canceled && method === 'GET')) {
      reply(response, 404, { object: 'error', type: 'not_found' });
      return;
    }

    if (method === 'DELETE') {
      subscription.canceled = true;
      reply(response, 200, { deleted: true, id: subscription.id });
      return;
    }

    reply(response, 200, publicView(subscription));
  }
}

function publicView(subscription: RemoteSubscription) {
  return {
    object: 'subscription',
    id: subscription.id,
    status: 1,
    plan_id: subscription.planId,
    card_id: subscription.cardId,
    next_billing_date: subscription.nextBillingDate,
    metadata: subscription.metadata,
  };
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}
