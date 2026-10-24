import { UnknownPlanError } from './billing.errors.js';
import { DEFAULT_PLAN_CODE, findPlan, PLANS, PlanCode } from './plan.js';
import {
  Subscription,
  SubscriptionState,
  TRIAL_DAYS,
} from './subscription.entity.js';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const start = () =>
  Subscription.startTrial({ id: 'sub-1', tenantId: 'tenant-1' }, NOW);

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

describe('Subscription', () => {
  it('starts a 7-day trial on the default plan', () => {
    const subscription = start();

    expect(TRIAL_DAYS).toBe(7);
    expect(subscription.planCode).toBe(DEFAULT_PLAN_CODE);
    expect(subscription.trialEndsAt.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
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
    const at = (offsetMs: number) =>
      subscription.daysLeftAt(new Date(NOW.getTime() + offsetMs));

    expect(at(0)).toBe(7);
    expect(at(1 * DAY_MS)).toBe(6);
    expect(at(6 * DAY_MS + 1 * HOUR_MS)).toBe(1);
    expect(at(7 * DAY_MS)).toBe(0);
    expect(at(30 * DAY_MS)).toBe(0);
  });

  it('changes the chosen plan without touching the trial', () => {
    const subscription = start();
    const later = new Date(NOW.getTime() + DAY_MS);

    subscription.choosePlan(PlanCode.Business, later);

    expect(subscription.planCode).toBe(PlanCode.Business);
    expect(subscription.trialEndsAt.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
    expect(subscription.toSnapshot().updatedAt).toEqual(later);
  });

  it('keeps the plan it already had when the new one is unknown', () => {
    const subscription = start();

    expect(() => subscription.choosePlan('FREE' as PlanCode, NOW)).toThrow(
      UnknownPlanError,
    );
    expect(subscription.planCode).toBe(DEFAULT_PLAN_CODE);
  });
});
