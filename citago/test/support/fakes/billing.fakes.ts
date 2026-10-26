import {
  PaymentGatewayError,
  PaymentProvider,
  type GatewaySubscription,
  type PaymentFailure,
} from '../../../src/modules/billing/application/ports/payment-provider.port.js';
import { PaymentSettings } from '../../../src/modules/billing/application/ports/payment-settings.port.js';
import { SubscriptionNoticeLog } from '../../../src/modules/billing/application/ports/subscription-notice-log.port.js';
import type { Notice } from '../../../src/modules/billing/domain/notice.js';
import type { PlanCode } from '../../../src/modules/billing/domain/plan.js';
import type { Subscription } from '../../../src/modules/billing/domain/subscription.entity.js';
import { SubscriptionRepository } from '../../../src/modules/billing/domain/subscription.repository.js';
import {
  EmailDeliveryError,
  EmailSender,
  type EmailMessage,
} from '../../../src/shared/application/ports/email-sender.port.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export class InMemorySubscriptionRepository extends SubscriptionRepository {
  readonly subscriptions = new Map<string, Subscription>();

  async findByTenant(tenantId: string): Promise<Subscription | null> {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.tenantId === tenantId) {
        return subscription;
      }
    }

    return null;
  }

  async findByGatewaySubscriptionId(id: string): Promise<Subscription | null> {
    return (
      [...this.subscriptions.values()].find(
        (subscription) => subscription.gatewaySubscriptionId === id,
      ) ?? null
    );
  }

  async findNearBoundary(
    now: Date,
    lookbackDays: number,
    lookaheadDays: number,
  ): Promise<Subscription[]> {
    const from = now.getTime() - lookbackDays * DAY_MS;
    const to = now.getTime() + lookaheadDays * DAY_MS;
    const within = (date: Date) =>
      date.getTime() >= from && date.getTime() <= to;

    return [...this.subscriptions.values()].filter((subscription) =>
      subscription.currentPeriodEnd === null
        ? within(subscription.trialEndsAt)
        : subscription.gatewaySubscriptionId !== null &&
          within(subscription.currentPeriodEnd),
    );
  }

  async save(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.id, subscription);
  }
}

/**
 * A gateway whose truth the test controls: `charges` renews, `remove` makes it
 * forget, `failNext` breaks the next call.
 */
export class FakePaymentProvider extends PaymentProvider {
  readonly calls: string[] = [];
  private sequence = 0;
  private failure: PaymentFailure | null = null;
  private failureMessage: string | null = null;
  readonly remote = new Map<string, GatewaySubscription>();

  constructor(private readonly now: () => Date = () => new Date()) {
    super();
  }

  failNext(failure: PaymentFailure, userMessage: string | null = null): void {
    this.failure = failure;
    this.failureMessage = userMessage;
  }

  renew(id: string, newPeriodEnd: Date): void {
    const current = this.remote.get(id);

    if (current) {
      this.remote.set(id, { ...current, periodEnd: newPeriodEnd });
    }
  }

  remove(id: string): void {
    this.remote.delete(id);
  }

  async subscribe(input: {
    readonly planCode: PlanCode;
    readonly tenantId: string;
    readonly cardToken: string;
    readonly customer: { readonly existingCustomerId: string | null };
  }): Promise<GatewaySubscription> {
    this.step(`subscribe:${input.planCode}:${input.cardToken}`);
    this.sequence += 1;

    const created: GatewaySubscription = {
      id: `sxn_${this.sequence}`,
      customerId: input.customer.existingCustomerId ?? `cus_${this.sequence}`,
      periodEnd: new Date(this.now().getTime() + 30 * DAY_MS),
      canceled: false,
    };

    this.remote.set(created.id, created);

    return created;
  }

  async fetchSubscription(id: string): Promise<GatewaySubscription | null> {
    this.step(`fetch:${id}`);

    return this.remote.get(id) ?? null;
  }

  async cancelSubscription(id: string): Promise<void> {
    this.step(`cancel:${id}`);

    const current = this.remote.get(id);

    if (current) {
      this.remote.set(id, { ...current, canceled: true });
    }
  }

  private step(call: string): void {
    this.calls.push(call);

    if (this.failure) {
      const failure = this.failure;
      const message = this.failureMessage;

      this.failure = null;
      this.failureMessage = null;
      throw new PaymentGatewayError(failure, message);
    }
  }
}

export class FixedPaymentSettings extends PaymentSettings {
  readonly publicKey = 'pk_test_fixed';
  readonly pageBaseUrl = 'https://api.citago.test';

  constructor(private enabled = true) {
    super();
  }

  isEnabledFor(): boolean {
    return this.enabled;
  }
}

export class RecordingEmailSender extends EmailSender {
  readonly sent: EmailMessage[] = [];
  private failure: EmailDeliveryError | null = null;

  failNext(retryable: boolean): void {
    this.failure = new EmailDeliveryError(retryable);
  }

  async send(message: EmailMessage): Promise<void> {
    if (this.failure) {
      const failure = this.failure;

      this.failure = null;
      throw failure;
    }

    this.sent.push(message);
  }
}

export class InMemoryNoticeLog extends SubscriptionNoticeLog {
  readonly claimed = new Set<string>();

  async claim(subscriptionId: string, notice: Notice): Promise<boolean> {
    const key = `${subscriptionId}|${notice.kind}|${notice.ref}`;

    if (this.claimed.has(key)) {
      return false;
    }

    this.claimed.add(key);

    return true;
  }

  async release(subscriptionId: string, notice: Notice): Promise<void> {
    this.claimed.delete(`${subscriptionId}|${notice.kind}|${notice.ref}`);
  }
}
