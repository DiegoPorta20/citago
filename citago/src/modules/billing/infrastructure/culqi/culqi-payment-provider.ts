import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../../../config/environment.js';
import {
  PaymentGatewayError,
  PaymentProvider,
  type GatewaySubscription,
} from '../../application/ports/payment-provider.port.js';
import type { PlanCode } from '../../domain/plan.js';

/*
 * Everything this app assumes about Culqi lives in this file.
 *
 * Built from Culqi's public documentation (docs.culqi.com: Suscripciones,
 * One-click, Webhooks), NOT yet exercised against Culqi's integration
 * environment. What to confirm with test keys before going live:
 *
 *  1. POST /customers requires first_name, last_name, email, address,
 *     address_city, country_code and phone_number; the placeholders below
 *     stand in for what we do not collect.
 *  2. A duplicated customer email is refused, and GET /customers?email= finds
 *     the existing one.
 *  3. POST /subscriptions {card_id, plan_id, tyc, metadata} charges the first
 *     period and answers with `next_billing_date`, as a Unix timestamp in
 *     seconds or milliseconds (both are handled).
 *  4. Cancelling is DELETE /subscriptions/{id}; a cancelled subscription is
 *     either gone (404) or reports status "canceled".
 *  5. A refused card answers 4xx with `type: "card_error"` and a
 *     `user_message` that is safe to show.
 *
 * The design leans on as little of this as possible: the period comes from
 * `next_billing_date`, and "cancelled" is also inferred from the period no
 * longer advancing, so a wrong guess about a status code fails safe (the
 * business stops being active) instead of granting free access.
 */

const REQUEST_TIMEOUT_MS = 20_000;

/** Culqi rejects empty values for these; we do not collect them. */
const PLACEHOLDER_ADDRESS = 'No registrada';
const PLACEHOLDER_PHONE = '999999999';
const PLACEHOLDER_LAST_NAME = 'Negocio';
const PLACEHOLDER_CITY = 'Lima';

interface CulqiErrorBody {
  readonly type?: unknown;
  readonly code?: unknown;
  readonly user_message?: unknown;
}

interface CulqiSubscriptionBody {
  readonly id?: unknown;
  readonly status?: unknown;
  readonly deleted?: unknown;
  readonly next_billing_date?: unknown;
}

@Injectable()
export class CulqiPaymentProvider extends PaymentProvider {
  private readonly apiUrl: string;
  private readonly secretKey: string;
  private readonly planIds: Readonly<Record<PlanCode, string>>;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.apiUrl = config
      .get('CULQI_API_URL', { infer: true })
      .replace(/\/+$/, '');
    this.secretKey = config.get('CULQI_SECRET_KEY', { infer: true });
    this.planIds = {
      STARTER: config.get('CULQI_PLAN_STARTER_ID', { infer: true }),
      PRO: config.get('CULQI_PLAN_PRO_ID', { infer: true }),
      BUSINESS: config.get('CULQI_PLAN_BUSINESS_ID', { infer: true }),
    } as Record<PlanCode, string>;
  }

  async subscribe(input: {
    readonly planCode: PlanCode;
    readonly tenantId: string;
    readonly cardToken: string;
    readonly customer: {
      readonly existingCustomerId: string | null;
      readonly email: string;
      readonly businessName: string;
      readonly country: string;
      readonly phone: string | null;
    };
  }): Promise<GatewaySubscription> {
    const planId = this.planIds[input.planCode];

    if (!planId || !this.secretKey) {
      throw new PaymentGatewayError('MISCONFIGURED');
    }

    const customerId =
      input.customer.existingCustomerId ??
      (await this.createCustomer(input.customer));
    const card = await this.call<{ id?: unknown }>('POST', '/cards', {
      customer_id: customerId,
      token_id: input.cardToken,
    });
    const cardId = requireString(card.id);
    const body = await this.call<CulqiSubscriptionBody>(
      'POST',
      '/subscriptions',
      {
        card_id: cardId,
        plan_id: planId,
        tyc: true,
        // Lets support find whose a charge is if our own record is ever lost.
        metadata: { tenant_id: input.tenantId, plan_code: input.planCode },
      },
    );

    return toSubscription(body, customerId);
  }

  async fetchSubscription(id: string): Promise<GatewaySubscription | null> {
    try {
      const body = await this.call<CulqiSubscriptionBody>(
        'GET',
        `/subscriptions/${encodeURIComponent(id)}`,
      );

      return toSubscription(body, null);
    } catch (error) {
      if (error instanceof NotFound) {
        return null;
      }

      throw error;
    }
  }

  async cancelSubscription(id: string): Promise<void> {
    try {
      await this.call('DELETE', `/subscriptions/${encodeURIComponent(id)}`);
    } catch (error) {
      if (!(error instanceof NotFound)) {
        throw error;
      }
    }
  }

  private async createCustomer(customer: {
    readonly email: string;
    readonly businessName: string;
    readonly country: string;
    readonly phone: string | null;
  }): Promise<string> {
    try {
      const created = await this.call<{ id?: unknown }>('POST', '/customers', {
        first_name: customer.businessName.slice(0, 50),
        last_name: PLACEHOLDER_LAST_NAME,
        email: customer.email,
        address: PLACEHOLDER_ADDRESS,
        address_city: PLACEHOLDER_CITY,
        country_code: customer.country,
        phone_number: (customer.phone ?? PLACEHOLDER_PHONE).replace(/\D/g, ''),
      });

      return requireString(created.id);
    } catch (error) {
      // Same email already registered with Culqi (a previous attempt, or the
      // owner paid before): reuse that customer instead of failing.
      if (
        error instanceof PaymentGatewayError &&
        error.failure === 'REJECTED'
      ) {
        const found = await this.call<{ data?: { id?: unknown }[] }>(
          'GET',
          `/customers?email=${encodeURIComponent(customer.email)}&limit=1`,
        );
        const id = found.data?.[0]?.id;

        if (typeof id === 'string' && id.length > 0) {
          return id;
        }
      }

      throw error;
    }
  }

  private async call<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    payload?: unknown,
  ): Promise<T> {
    if (!this.secretKey) {
      throw new PaymentGatewayError('MISCONFIGURED');
    }

    let response: Response;

    try {
      response = await fetch(`${this.apiUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          ...(payload === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new PaymentGatewayError('UNAVAILABLE');
    }

    const body: unknown = await response.json().catch(() => null);

    if (response.ok) {
      return (body ?? {}) as T;
    }

    throw classify(response.status, body as CulqiErrorBody | null);
  }
}

class NotFound extends PaymentGatewayError {
  constructor() {
    super('REJECTED');
  }
}

function classify(
  status: number,
  body: CulqiErrorBody | null,
): PaymentGatewayError {
  if (status === 404) {
    return new NotFound();
  }
  if (status === 401 || status === 403) {
    return new PaymentGatewayError('MISCONFIGURED');
  }
  if (status === 429 || status >= 500) {
    return new PaymentGatewayError('UNAVAILABLE');
  }

  const message =
    typeof body?.user_message === 'string' ? body.user_message : null;

  return body?.type === 'card_error'
    ? new PaymentGatewayError('DECLINED', message)
    : new PaymentGatewayError('REJECTED', message);
}

function toSubscription(
  body: CulqiSubscriptionBody,
  customerId: string | null,
): GatewaySubscription {
  return {
    id: requireString(body.id),
    customerId,
    periodEnd: parseTimestamp(body.next_billing_date),
    canceled: isCanceled(body),
  };
}

function isCanceled(body: CulqiSubscriptionBody): boolean {
  if (body.deleted === true) {
    return true;
  }

  const status =
    typeof body.status === 'string' ? body.status.toLowerCase() : '';

  return status === 'canceled' || status === 'cancelled';
}

/** Unix seconds or milliseconds, as a number or a numeric string. */
function parseTimestamp(value: unknown): Date | null {
  const raw = typeof value === 'string' ? Number(value) : value;

  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }

  const date = new Date(raw < 1e12 ? raw * 1000 : raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

function requireString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    // The gateway answered 2xx without the id we need: treat as an outage.
    throw new PaymentGatewayError('UNAVAILABLE');
  }

  return value;
}
