import { findPlan, DEFAULT_PLAN_CODE, type PlanCode } from './plan.js';

export const TRIAL_DAYS = 7;

/**
 * After a paid period ends the business keeps working this long while we wait
 * for the renewal to go through (cards fail and are retried). Past it, the
 * business is read-only until it pays.
 */
export const GRACE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export enum SubscriptionState {
  /** Free trial running. */
  Trialing = 'TRIALING',
  /** Paid and inside the paid period. */
  Active = 'ACTIVE',
  /** The paid period ended and the renewal has not arrived: still works, for a few days. */
  PastDue = 'PAST_DUE',
  /** Trial over, or past due beyond the grace: read-only. */
  Expired = 'EXPIRED',
}

export interface SubscriptionSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly planCode: PlanCode;
  readonly trialEndsAt: Date;
  readonly gatewaySubscriptionId: string | null;
  readonly gatewayCustomerId: string | null;
  /** End of the period already paid; moves forward with each renewal. */
  readonly currentPeriodEnd: Date | null;
  /** Set when renewal was stopped. Access lasts until `currentPeriodEnd`. */
  readonly canceledAt: Date | null;
  readonly lastSyncedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GatewayFacts {
  /** `null` when the gateway did not say when the next charge is. */
  readonly periodEnd: Date | null;
  readonly canceled: boolean;
}

export class Subscription {
  private constructor(private state: SubscriptionSnapshot) {}

  static startTrial(
    input: { id: string; tenantId: string; planCode?: PlanCode },
    now: Date,
  ): Subscription {
    const plan = findPlan(input.planCode ?? DEFAULT_PLAN_CODE);

    return new Subscription({
      id: input.id,
      tenantId: input.tenantId,
      planCode: plan.code,
      trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * DAY_MS),
      gatewaySubscriptionId: null,
      gatewayCustomerId: null,
      currentPeriodEnd: null,
      canceledAt: null,
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(snapshot: SubscriptionSnapshot): Subscription {
    return new Subscription(snapshot);
  }

  /** Records the plan the business wants. Paying is what makes it real. */
  choosePlan(planCode: PlanCode, now: Date): void {
    this.state = {
      ...this.state,
      planCode: findPlan(planCode).code,
      updatedAt: now,
    };
  }

  /** The gateway accepted a card and started charging this plan. */
  activate(
    input: {
      readonly planCode: PlanCode;
      readonly gatewaySubscriptionId: string;
      readonly gatewayCustomerId: string;
      readonly periodEnd: Date;
    },
    now: Date,
  ): void {
    this.state = {
      ...this.state,
      planCode: findPlan(input.planCode).code,
      gatewaySubscriptionId: input.gatewaySubscriptionId,
      gatewayCustomerId: input.gatewayCustomerId,
      currentPeriodEnd: input.periodEnd,
      canceledAt: null,
      lastSyncedAt: now,
      updatedAt: now,
    };
  }

  /**
   * Applies what the gateway says. Safe to repeat and to receive out of order:
   * the paid period only ever moves forward, and a cancellation, once seen,
   * stays.
   */
  syncFromGateway(facts: GatewayFacts, now: Date): void {
    const current = this.state.currentPeriodEnd;
    const advances =
      facts.periodEnd !== null &&
      (current === null || facts.periodEnd.getTime() > current.getTime());

    this.state = {
      ...this.state,
      currentPeriodEnd: advances ? facts.periodEnd : current,
      canceledAt: this.state.canceledAt ?? (facts.canceled ? now : null),
      lastSyncedAt: now,
      updatedAt: now,
    };
  }

  /** Stops renewal. What was paid for stays usable until the period ends. */
  cancel(now: Date): void {
    if (this.state.canceledAt === null) {
      this.state = { ...this.state, canceledAt: now, updatedAt: now };
    }
  }

  stateAt(now: Date): SubscriptionState {
    const periodEnd = this.state.currentPeriodEnd;

    if (periodEnd !== null) {
      const at = now.getTime();

      if (at < periodEnd.getTime()) {
        return SubscriptionState.Active;
      }

      return this.state.canceledAt === null &&
        at < periodEnd.getTime() + GRACE_DAYS * DAY_MS
        ? SubscriptionState.PastDue
        : SubscriptionState.Expired;
    }

    return now.getTime() < this.state.trialEndsAt.getTime()
      ? SubscriptionState.Trialing
      : SubscriptionState.Expired;
  }

  hasAccessAt(now: Date): boolean {
    return this.stateAt(now) !== SubscriptionState.Expired;
  }

  /** Whole days left in the trial or the paid period, rounded up. */
  daysLeftAt(now: Date): number {
    const end = this.state.currentPeriodEnd ?? this.state.trialEndsAt;
    const remaining = end.getTime() - now.getTime();

    return remaining <= 0 ? 0 : Math.ceil(remaining / DAY_MS);
  }

  get isPaying(): boolean {
    return this.state.gatewaySubscriptionId !== null;
  }

  /** Paying, and the gateway will charge again. */
  get renews(): boolean {
    return this.isPaying && this.state.canceledAt === null;
  }

  /**
   * Worth asking the gateway about: it charges on its own schedule, so a
   * paid period that ran out may simply not have been told to us yet.
   */
  mayHaveRenewedAt(now: Date): boolean {
    return this.renews && this.stateAt(now) !== SubscriptionState.Active;
  }

  get id(): string {
    return this.state.id;
  }

  get tenantId(): string {
    return this.state.tenantId;
  }

  get planCode(): PlanCode {
    return this.state.planCode;
  }

  get trialEndsAt(): Date {
    return this.state.trialEndsAt;
  }

  get currentPeriodEnd(): Date | null {
    return this.state.currentPeriodEnd;
  }

  get gatewaySubscriptionId(): string | null {
    return this.state.gatewaySubscriptionId;
  }

  get gatewayCustomerId(): string | null {
    return this.state.gatewayCustomerId;
  }

  toSnapshot(): SubscriptionSnapshot {
    return this.state;
  }
}
