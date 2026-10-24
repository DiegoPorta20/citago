import { findPlan, DEFAULT_PLAN_CODE, type PlanCode } from './plan.js';

export const TRIAL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export enum SubscriptionState {
  Trialing = 'TRIALING',
  Expired = 'EXPIRED',
}

export interface SubscriptionSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly planCode: PlanCode;
  readonly trialEndsAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
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
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(snapshot: SubscriptionSnapshot): Subscription {
    return new Subscription(snapshot);
  }

  /** Records the plan the business wants. Nothing is charged until a payment gateway exists. */
  choosePlan(planCode: PlanCode, now: Date): void {
    this.state = {
      ...this.state,
      planCode: findPlan(planCode).code,
      updatedAt: now,
    };
  }

  stateAt(now: Date): SubscriptionState {
    return now.getTime() < this.state.trialEndsAt.getTime()
      ? SubscriptionState.Trialing
      : SubscriptionState.Expired;
  }

  hasAccessAt(now: Date): boolean {
    return this.stateAt(now) !== SubscriptionState.Expired;
  }

  /** Whole days left, rounded up so "23 hours left" reads as 1 day, never 0. */
  daysLeftAt(now: Date): number {
    const remaining = this.state.trialEndsAt.getTime() - now.getTime();

    return remaining <= 0 ? 0 : Math.ceil(remaining / DAY_MS);
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

  toSnapshot(): SubscriptionSnapshot {
    return this.state;
  }
}
