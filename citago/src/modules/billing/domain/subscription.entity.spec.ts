import { UnknownPlanError } from './billing.errors.js';
import { DEFAULT_PLAN_CODE, findPlan, PLANS, PlanCode } from './plan.js';
import {
  GRACE_DAYS,
  Subscription,
  SubscriptionState,
  TRIAL_DAYS,
} from './subscription.entity.js';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

const start = () =>
  Subscription.startTrial({ id: 'sub-1', tenantId: 'tenant-1' }, NOW);

const paying = (periodDays = 30) => {
  const subscription = start();

  subscription.activate(
    {
      planCode: PlanCode.Pro,
      gatewaySubscriptionId: 'sxn_1',
      gatewayCustomerId: 'cus_1',
      periodEnd: at(periodDays * DAY_MS),
    },
    NOW,
  );

  return subscription;
};

describe('plans', () => {
  it('sells exactly three plans, cheapest first', () => {
    expect(PLANS.map((plan) => plan.code)).toEqual([
      PlanCode.Starter,
      PlanCode.Pro,
      PlanCode.Business,
    ]);

    const prices = PLANS.map((plan) => plan.monthlyPrice.cents);

    expect(prices).toEqual([...prices].sort((a, b) => Number(a - b)));
  });

  it('prices every plan in soles, as decimal strings', () => {
    expect(PLANS.every((plan) => plan.currency === 'PEN')).toBe(true);
    expect(findPlan(PlanCode.Pro).monthlyPrice.toDecimalString()).toBe('79.00');
  });

  it('allows more professionals the more expensive the plan is', () => {
    const limits = PLANS.map((plan) => plan.maxStaff);

    expect(limits).toEqual([...limits].sort((a, b) => a - b));
  });

  it('rejects a plan that does not exist', () => {
    expect(() => findPlan('FREE')).toThrow(UnknownPlanError);
  });
});

describe('Subscription: the free trial', () => {
  it('starts a 7-day trial on the default plan', () => {
    const subscription = start();

    expect(TRIAL_DAYS).toBe(7);
    expect(subscription.planCode).toBe(DEFAULT_PLAN_CODE);
    expect(subscription.trialEndsAt.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
    expect(subscription.isPaying).toBe(false);
    expect(subscription.renews).toBe(false);
  });

  it('can start on another plan', () => {
    const subscription = Subscription.startTrial(
      { id: 'sub-1', tenantId: 'tenant-1', planCode: PlanCode.Starter },
      NOW,
    );

    expect(subscription.planCode).toBe(PlanCode.Starter);
  });

  it('is trialing right up to the last millisecond, expired from the end', () => {
    const subscription = start();
    const end = subscription.trialEndsAt.getTime();

    expect(subscription.stateAt(NOW)).toBe(SubscriptionState.Trialing);
    expect(subscription.stateAt(new Date(end - 1))).toBe(
      SubscriptionState.Trialing,
    );
    expect(subscription.stateAt(new Date(end))).toBe(SubscriptionState.Expired);
    expect(subscription.hasAccessAt(new Date(end - 1))).toBe(true);
    expect(subscription.hasAccessAt(new Date(end))).toBe(false);
  });

  it('rounds the days left up, so the last day never reads as 0', () => {
    const subscription = start();
    const left = (offsetMs: number) => subscription.daysLeftAt(at(offsetMs));

    expect(left(0)).toBe(7);
    expect(left(1 * DAY_MS)).toBe(6);
    expect(left(6 * DAY_MS + 1 * HOUR_MS)).toBe(1);
    expect(left(7 * DAY_MS)).toBe(0);
    expect(left(30 * DAY_MS)).toBe(0);
  });

  it('changes the chosen plan without touching the trial', () => {
    const subscription = start();

    subscription.choosePlan(PlanCode.Business, at(DAY_MS));

    expect(subscription.planCode).toBe(PlanCode.Business);
    expect(subscription.trialEndsAt.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
    expect(subscription.toSnapshot().updatedAt).toEqual(at(DAY_MS));
  });

  it('keeps the plan it already had when the new one is unknown', () => {
    const subscription = start();

    expect(() => subscription.choosePlan('FREE' as PlanCode, NOW)).toThrow(
      UnknownPlanError,
    );
    expect(subscription.planCode).toBe(DEFAULT_PLAN_CODE);
  });
});

describe('Subscription: paying', () => {
  it('becomes active the moment the gateway accepts a card, even mid-trial', () => {
    const subscription = paying();

    expect(subscription.stateAt(at(1 * DAY_MS))).toBe(SubscriptionState.Active);
    expect(subscription.isPaying).toBe(true);
    expect(subscription.renews).toBe(true);
    expect(subscription.gatewaySubscriptionId).toBe('sxn_1');
  });

  it('takes the plan it was paid for', () => {
    const subscription = start();

    subscription.activate(
      {
        planCode: PlanCode.Business,
        gatewaySubscriptionId: 'sxn_9',
        gatewayCustomerId: 'cus_9',
        periodEnd: at(30 * DAY_MS),
      },
      NOW,
    );

    expect(subscription.planCode).toBe(PlanCode.Business);
  });

  it('counts the days left of the paid period, not of the trial', () => {
    const subscription = paying(30);

    expect(subscription.daysLeftAt(NOW)).toBe(30);
    expect(subscription.daysLeftAt(at(29 * DAY_MS + HOUR_MS))).toBe(1);
  });

  describe('when the paid period ends without a renewal', () => {
    it('keeps working through the grace days, as past due', () => {
      const subscription = paying(30);
      const end = 30 * DAY_MS;

      expect(subscription.stateAt(at(end - 1))).toBe(SubscriptionState.Active);
      expect(subscription.stateAt(at(end))).toBe(SubscriptionState.PastDue);
      expect(subscription.hasAccessAt(at(end + 1 * DAY_MS))).toBe(true);
      expect(GRACE_DAYS).toBe(3);
      expect(subscription.stateAt(at(end + GRACE_DAYS * DAY_MS - 1))).toBe(
        SubscriptionState.PastDue,
      );
    });

    it('turns read-only once the grace is over', () => {
      const subscription = paying(30);
      const lapsed = at(30 * DAY_MS + GRACE_DAYS * DAY_MS);

      expect(subscription.stateAt(lapsed)).toBe(SubscriptionState.Expired);
      expect(subscription.hasAccessAt(lapsed)).toBe(false);
    });
  });

  describe('syncing with the gateway', () => {
    it('moves the paid period forward when the gateway charged again', () => {
      const subscription = paying(30);

      subscription.syncFromGateway(
        { periodEnd: at(60 * DAY_MS), canceled: false },
        at(31 * DAY_MS),
      );

      expect(subscription.currentPeriodEnd).toEqual(at(60 * DAY_MS));
      expect(subscription.stateAt(at(31 * DAY_MS))).toBe(
        SubscriptionState.Active,
      );
    });

    it('is idempotent: hearing the same thing twice changes nothing', () => {
      const subscription = paying(30);
      const facts = { periodEnd: at(60 * DAY_MS), canceled: false };

      subscription.syncFromGateway(facts, at(31 * DAY_MS));
      const once = subscription.toSnapshot().currentPeriodEnd;
      subscription.syncFromGateway(facts, at(31 * DAY_MS));

      expect(subscription.toSnapshot().currentPeriodEnd).toEqual(once);
    });

    it('never moves the period backwards: a late, stale answer is harmless', () => {
      const subscription = paying(30);

      subscription.syncFromGateway(
        { periodEnd: at(60 * DAY_MS), canceled: false },
        at(31 * DAY_MS),
      );
      subscription.syncFromGateway(
        { periodEnd: at(30 * DAY_MS), canceled: false },
        at(32 * DAY_MS),
      );

      expect(subscription.currentPeriodEnd).toEqual(at(60 * DAY_MS));
    });

    it('leaves the period alone when the gateway did not say', () => {
      const subscription = paying(30);

      subscription.syncFromGateway({ periodEnd: null, canceled: false }, NOW);

      expect(subscription.currentPeriodEnd).toEqual(at(30 * DAY_MS));
    });

    it('remembers a cancellation for good', () => {
      const subscription = paying(30);

      subscription.syncFromGateway({ periodEnd: null, canceled: true }, NOW);
      subscription.syncFromGateway(
        { periodEnd: at(60 * DAY_MS), canceled: false },
        at(1 * DAY_MS),
      );

      expect(subscription.renews).toBe(false);
    });
  });

  describe('cancelling', () => {
    it('keeps the paid period usable but stops the renewal', () => {
      const subscription = paying(30);

      subscription.cancel(at(2 * DAY_MS));

      expect(subscription.renews).toBe(false);
      expect(subscription.isPaying).toBe(true);
      expect(subscription.stateAt(at(29 * DAY_MS))).toBe(
        SubscriptionState.Active,
      );
    });

    it('gets no grace days: nothing is pending, it simply ended', () => {
      const subscription = paying(30);

      subscription.cancel(at(2 * DAY_MS));

      expect(subscription.stateAt(at(30 * DAY_MS))).toBe(
        SubscriptionState.Expired,
      );
    });

    it('is not asked about the gateway again', () => {
      const subscription = paying(30);

      subscription.cancel(NOW);

      expect(subscription.mayHaveRenewedAt(at(40 * DAY_MS))).toBe(false);
    });
  });

  describe('mayHaveRenewedAt', () => {
    it('is false while the paid period still runs', () => {
      expect(paying(30).mayHaveRenewedAt(at(10 * DAY_MS))).toBe(false);
    });

    it('is true once the period ran out and the gateway should have charged', () => {
      expect(paying(30).mayHaveRenewedAt(at(30 * DAY_MS))).toBe(true);
      expect(paying(30).mayHaveRenewedAt(at(40 * DAY_MS))).toBe(true);
    });

    it('is false for someone who never paid: there is nothing to ask', () => {
      expect(start().mayHaveRenewedAt(at(20 * DAY_MS))).toBe(false);
    });
  });
});
