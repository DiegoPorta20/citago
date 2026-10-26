import { Injectable, Logger } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { HandoffTokens } from '../../../shared/application/ports/handoff-tokens.port.js';
import type { HandoffClaims } from '../../../shared/application/ports/handoff-tokens.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import { TenantRepository } from '../../tenants/domain/tenant.repository.js';
import {
  AlreadySubscribedError,
  NotPayingError,
  PaymentDeclinedError,
  PaymentsNotConfiguredError,
  PaymentUnavailableError,
  PlanChangeRequiresPaymentError,
  SubscriptionExpiredError,
  SubscriptionNotFoundError,
} from '../domain/billing.errors.js';
import { findPlan, PLANS, type Plan, type PlanCode } from '../domain/plan.js';
import {
  SubscriptionState,
  type Subscription,
} from '../domain/subscription.entity.js';
import { SubscriptionRepository } from '../domain/subscription.repository.js';
import {
  PaymentProvider,
  PaymentGatewayError,
} from './ports/payment-provider.port.js';
import { PaymentSettings } from './ports/payment-settings.port.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** With no `next_billing_date` from the gateway, assume a month; a sync corrects it. */
const FALLBACK_PERIOD_DAYS = 31;

/** Ask the gateway about one subscription at most this often per process. */
const SYNC_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_TRACKED_ATTEMPTS = 5_000;

export interface SubscriptionView {
  readonly plan: Plan;
  readonly state: SubscriptionState;
  readonly trialEndsAt: Date;
  /** End of the period already paid for; `null` while on the trial. */
  readonly currentPeriodEnd: Date | null;
  readonly renews: boolean;
  /** Days left in the trial or in the paid period. */
  readonly daysLeft: number;
  /** Whether this plan can be paid for online right now. */
  readonly paymentsEnabled: boolean;
}

function toView(
  subscription: Subscription,
  now: Date,
  settings: PaymentSettings,
): SubscriptionView {
  return {
    plan: findPlan(subscription.planCode),
    state: subscription.stateAt(now),
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
    renews: subscription.renews,
    daysLeft: subscription.daysLeftAt(now),
    paymentsEnabled: settings.isEnabledFor(subscription.planCode),
  };
}

async function loadSubscription(
  subscriptions: SubscriptionRepository,
  tenantId: string,
): Promise<Subscription> {
  const subscription = await subscriptions.findByTenant(tenantId);

  if (!subscription) {
    throw new SubscriptionNotFoundError();
  }

  return subscription;
}

/**
 * The gateway charges on its own schedule and tells us (webhook) when it
 * remembers to. Whatever it says, the truth is what it returns when asked, so
 * every path ends up here: ask, apply, save. Applying is idempotent.
 */
@Injectable()
export class SubscriptionSync {
  private readonly logger = new Logger(SubscriptionSync.name);
  private readonly attempts = new Map<string, number>();

  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly provider: PaymentProvider,
    private readonly clock: Clock,
  ) {}

  /**
   * Called on the way past (reading the plan, any write): when a paid period
   * ran out it may only mean the renewal has not been recorded yet. Never
   * throws, never asks twice in a row: a gateway outage must not stop anyone
   * from working.
   */
  async refreshIfDue(subscription: Subscription): Promise<void> {
    const now = this.clock.now();

    if (!subscription.mayHaveRenewedAt(now)) {
      return;
    }

    const last = this.attempts.get(subscription.id);

    if (last !== undefined && now.getTime() - last < SYNC_COOLDOWN_MS) {
      return;
    }

    if (this.attempts.size >= MAX_TRACKED_ATTEMPTS) {
      this.attempts.clear();
    }
    this.attempts.set(subscription.id, now.getTime());

    try {
      await this.syncNow(subscription);
    } catch (error) {
      this.logger.warn(
        `Could not refresh subscription ${subscription.id} from the gateway: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Throws when the gateway cannot be reached (callers decide what to do). */
  async syncNow(subscription: Subscription): Promise<void> {
    const gatewayId = subscription.gatewaySubscriptionId;

    if (gatewayId === null) {
      return;
    }

    const remote = await this.provider.fetchSubscription(gatewayId);

    subscription.syncFromGateway(
      remote
        ? { periodEnd: remote.periodEnd, canceled: remote.canceled }
        : // The gateway no longer knows it: nothing will be charged again.
          { periodEnd: null, canceled: true },
      this.clock.now(),
    );
    await this.subscriptions.save(subscription);
  }
}

@Injectable()
export class ListPlansUseCase {
  execute(): readonly Plan[] {
    return PLANS;
  }
}

@Injectable()
export class GetSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly sync: SubscriptionSync,
    private readonly settings: PaymentSettings,
    private readonly clock: Clock,
  ) {}

  async execute(actor: AuthContext): Promise<SubscriptionView> {
    const subscription = await loadSubscription(
      this.subscriptions,
      actor.tenantId,
    );

    await this.sync.refreshIfDue(subscription);

    return toView(subscription, this.clock.now(), this.settings);
  }
}

@Injectable()
export class ChoosePlanUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly transaction: TransactionRunner,
    private readonly settings: PaymentSettings,
    private readonly clock: Clock,
  ) {}

  execute(actor: AuthContext, planCode: PlanCode): Promise<SubscriptionView> {
    return this.transaction.run(async () => {
      const subscription = await loadSubscription(
        this.subscriptions,
        actor.tenantId,
      );

      // A paying business changes plan by paying for the new one, which
      // replaces the old; editing a preference would leave the card charging
      // the wrong amount.
      if (subscription.renews) {
        throw new PlanChangeRequiresPaymentError();
      }

      const now = this.clock.now();

      subscription.choosePlan(planCode, now);
      await this.subscriptions.save(subscription);

      return toView(subscription, now, this.settings);
    });
  }
}

/**
 * Decides whether a business may still change data. A business without a
 * subscription row is not restricted: registration always creates one and the
 * migration backfills the rest, so "none" only happens for hand-made data.
 */
@Injectable()
export class AssertSubscriptionAccessUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly sync: SubscriptionSync,
    private readonly clock: Clock,
  ) {}

  async execute(tenantId: string): Promise<void> {
    const subscription = await this.subscriptions.findByTenant(tenantId);

    if (!subscription) {
      return;
    }

    await this.sync.refreshIfDue(subscription);

    if (!subscription.hasAccessAt(this.clock.now())) {
      throw new SubscriptionExpiredError();
    }
  }
}

export interface CheckoutSession {
  readonly url: string;
  readonly expiresInSeconds: number;
}

/** The app asks for a link; the link opens the card form in the browser. */
@Injectable()
export class StartCheckoutUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly settings: PaymentSettings,
    private readonly tokens: HandoffTokens,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    requested?: PlanCode,
  ): Promise<CheckoutSession> {
    const subscription = await loadSubscription(
      this.subscriptions,
      actor.tenantId,
    );
    const plan = findPlan(requested ?? subscription.planCode);

    if (!this.settings.isEnabledFor(plan.code)) {
      throw new PaymentsNotConfiguredError();
    }
    assertNotAlreadyPaying(subscription, plan.code, this.clock.now());

    const token = this.tokens.issue({
      tenantId: actor.tenantId,
      userId: actor.userId,
      purpose: 'checkout',
      subject: plan.code,
    });

    return {
      // In the fragment: it never reaches a server log or a Referer header.
      url: `${this.settings.pageBaseUrl}/api/v1/pages/checkout#t=${token}`,
      expiresInSeconds: this.tokens.ttlSeconds,
    };
  }
}

export interface CheckoutConfig {
  readonly publicKey: string;
  readonly plan: Plan;
}

@Injectable()
export class GetCheckoutConfigUseCase {
  constructor(private readonly settings: PaymentSettings) {}

  execute(claims: HandoffClaims): CheckoutConfig {
    const plan = findPlan(claims.subject ?? '');

    if (!this.settings.isEnabledFor(plan.code)) {
      throw new PaymentsNotConfiguredError();
    }

    return { publicKey: this.settings.publicKey, plan };
  }
}

/**
 * The browser tokenized the card with Culqi's public key; the token is all we
 * ever see of it. Charging for the plan the link was issued for, the gateway
 * creates the customer, saves the card and starts the recurring charge.
 */
@Injectable()
export class CompleteCheckoutUseCase {
  private readonly logger = new Logger(CompleteCheckoutUseCase.name);

  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly tenants: TenantRepository,
    private readonly provider: PaymentProvider,
    private readonly settings: PaymentSettings,
    private readonly transaction: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(
    claims: HandoffClaims,
    input: { readonly cardToken: string; readonly email: string },
  ): Promise<SubscriptionView> {
    const plan = findPlan(claims.subject ?? '');

    if (!this.settings.isEnabledFor(plan.code)) {
      throw new PaymentsNotConfiguredError();
    }

    const subscription = await loadSubscription(
      this.subscriptions,
      claims.tenantId,
    );

    // A double tap, or a second tab: the first one already paid.
    assertNotAlreadyPaying(subscription, plan.code, this.clock.now());

    const tenant = await this.tenants.findById(claims.tenantId);

    if (!tenant) {
      throw new SubscriptionNotFoundError();
    }

    let created;

    try {
      created = await this.provider.subscribe({
        planCode: plan.code,
        tenantId: claims.tenantId,
        cardToken: input.cardToken,
        customer: {
          existingCustomerId: subscription.gatewayCustomerId,
          email: input.email,
          businessName: tenant.name,
          country: tenant.country,
          phone: tenant.phone,
        },
      });
    } catch (error) {
      throw toDomainError(error);
    }

    const replaced = subscription.renews
      ? subscription.gatewaySubscriptionId
      : null;
    const now = this.clock.now();

    await this.transaction.run(async () => {
      subscription.activate(
        {
          planCode: plan.code,
          gatewaySubscriptionId: created.id,
          gatewayCustomerId:
            created.customerId ?? subscription.gatewayCustomerId ?? '',
          periodEnd:
            created.periodEnd ??
            new Date(now.getTime() + FALLBACK_PERIOD_DAYS * DAY_MS),
        },
        now,
      );
      await this.subscriptions.save(subscription);
    });

    if (replaced !== null && replaced !== created.id) {
      await this.stopCharging(replaced, claims.tenantId, created.id);
    }

    return toView(subscription, now, this.settings);
  }

  /**
   * The new subscription already charges, so the old one must stop or the
   * customer pays twice. If that call fails the operator has to know exactly
   * which one to cancel.
   */
  private async stopCharging(
    oldId: string,
    tenantId: string,
    newId: string,
  ): Promise<void> {
    try {
      await this.provider.cancelSubscription(oldId);
    } catch (error) {
      this.logger.error(
        `ACTION REQUIRED: tenant ${tenantId} now pays through ${newId} but ${oldId} could not be cancelled and may charge twice: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

@Injectable()
export class CancelSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly provider: PaymentProvider,
    private readonly settings: PaymentSettings,
    private readonly clock: Clock,
  ) {}

  async execute(actor: AuthContext): Promise<SubscriptionView> {
    const subscription = await loadSubscription(
      this.subscriptions,
      actor.tenantId,
    );
    const gatewayId = subscription.gatewaySubscriptionId;

    if (!subscription.renews || gatewayId === null) {
      throw new NotPayingError();
    }

    try {
      await this.provider.cancelSubscription(gatewayId);
    } catch (error) {
      throw toDomainError(error);
    }

    const now = this.clock.now();

    subscription.cancel(now);
    await this.subscriptions.save(subscription);

    return toView(subscription, now, this.settings);
  }
}

/** A gateway notification: it names a subscription, we go and ask. */
@Injectable()
export class HandleGatewayEventUseCase {
  private readonly logger = new Logger(HandleGatewayEventUseCase.name);

  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly sync: SubscriptionSync,
  ) {}

  /** Throws only if the gateway is unreachable, so it retries the delivery. */
  async execute(gatewaySubscriptionId: string): Promise<void> {
    const subscription = await this.subscriptions.findByGatewaySubscriptionId(
      gatewaySubscriptionId,
    );

    if (!subscription) {
      this.logger.debug(
        `Ignoring an event about unknown subscription ${gatewaySubscriptionId}`,
      );
      return;
    }

    try {
      await this.sync.syncNow(subscription);
    } catch (error) {
      throw toDomainError(error);
    }
  }
}

function assertNotAlreadyPaying(
  subscription: Subscription,
  planCode: PlanCode,
  now: Date,
): void {
  if (
    subscription.renews &&
    subscription.planCode === planCode &&
    subscription.stateAt(now) === SubscriptionState.Active
  ) {
    throw new AlreadySubscribedError();
  }
}

function toDomainError(error: unknown): Error {
  if (!(error instanceof PaymentGatewayError)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  switch (error.failure) {
    case 'DECLINED':
    case 'REJECTED':
      return new PaymentDeclinedError(error.userMessage);
    case 'MISCONFIGURED':
      return new PaymentsNotConfiguredError();
    default:
      return new PaymentUnavailableError();
  }
}
