import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import {
  SubscriptionExpiredError,
  SubscriptionNotFoundError,
} from '../domain/billing.errors.js';
import { findPlan, PLANS, type Plan, type PlanCode } from '../domain/plan.js';
import type {
  Subscription,
  SubscriptionState,
} from '../domain/subscription.entity.js';
import { SubscriptionRepository } from '../domain/subscription.repository.js';

export interface SubscriptionView {
  readonly plan: Plan;
  readonly state: SubscriptionState;
  readonly trialEndsAt: Date;
  readonly daysLeft: number;
}

function toView(subscription: Subscription, now: Date): SubscriptionView {
  return {
    plan: findPlan(subscription.planCode),
    state: subscription.stateAt(now),
    trialEndsAt: subscription.trialEndsAt,
    daysLeft: subscription.daysLeftAt(now),
  };
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
    private readonly clock: Clock,
  ) {}

  async execute(actor: AuthContext): Promise<SubscriptionView> {
    const subscription = await this.subscriptions.findByTenant(actor.tenantId);

    if (!subscription) {
      throw new SubscriptionNotFoundError();
    }

    return toView(subscription, this.clock.now());
  }
}

@Injectable()
export class ChoosePlanUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly transaction: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  execute(actor: AuthContext, planCode: PlanCode): Promise<SubscriptionView> {
    return this.transaction.run(async () => {
      const subscription = await this.subscriptions.findByTenant(
        actor.tenantId,
      );

      if (!subscription) {
        throw new SubscriptionNotFoundError();
      }

      const now = this.clock.now();

      subscription.choosePlan(planCode, now);
      await this.subscriptions.save(subscription);

      return toView(subscription, now);
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
    private readonly clock: Clock,
  ) {}

  async execute(tenantId: string): Promise<void> {
    const subscription = await this.subscriptions.findByTenant(tenantId);

    if (subscription && !subscription.hasAccessAt(this.clock.now())) {
      throw new SubscriptionExpiredError();
    }
  }
}
