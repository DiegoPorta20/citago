import { InMemorySubscriptionRepository } from '../../../../test/support/fakes/billing.fakes.js';
import {
  FixedClock,
  ImmediateTransactionRunner,
} from '../../../../test/support/fakes/identity.fakes.js';
import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import {
  SubscriptionExpiredError,
  SubscriptionNotFoundError,
  UnknownPlanError,
} from '../domain/billing.errors.js';
import { PLANS, PlanCode } from '../domain/plan.js';
import {
  Subscription,
  SubscriptionState,
} from '../domain/subscription.entity.js';
import {
  AssertSubscriptionAccessUseCase,
  ChoosePlanUseCase,
  GetSubscriptionUseCase,
  ListPlansUseCase,
} from './billing.use-cases.js';

const NOW = new Date('2026-10-23T12:00:00.000Z');

const ownerA: AuthContext = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  membershipId: 'membership-a',
  role: UserRole.Owner,
};

const ownerB: AuthContext = { ...ownerA, tenantId: 'tenant-b' };

describe('Billing use cases', () => {
  let subscriptions: InMemorySubscriptionRepository;
  let clock: FixedClock;
  let get: GetSubscriptionUseCase;
  let choose: ChoosePlanUseCase;
  let assertAccess: AssertSubscriptionAccessUseCase;

  const startTrial = (tenantId: string) =>
    subscriptions.save(
      Subscription.startTrial({ id: `sub-${tenantId}`, tenantId }, NOW),
    );

  beforeEach(async () => {
    subscriptions = new InMemorySubscriptionRepository();
    clock = new FixedClock(NOW);
    get = new GetSubscriptionUseCase(subscriptions, clock);
    choose = new ChoosePlanUseCase(
      subscriptions,
      new ImmediateTransactionRunner(),
      clock,
    );
    assertAccess = new AssertSubscriptionAccessUseCase(subscriptions, clock);

    await startTrial('tenant-a');
    await startTrial('tenant-b');
  });

  it('lists the three plans', () => {
    expect(new ListPlansUseCase().execute()).toBe(PLANS);
  });

  it('describes the trial of the caller’s business', async () => {
    const view = await get.execute(ownerA);

    expect(view.state).toBe(SubscriptionState.Trialing);
    expect(view.daysLeft).toBe(7);
    expect(view.plan.code).toBe(PlanCode.Pro);
  });

  it('counts the trial down and reports it expired afterwards', async () => {
    clock.advanceDays(3);
    await expect(get.execute(ownerA)).resolves.toMatchObject({ daysLeft: 4 });

    clock.advanceDays(4);
    await expect(get.execute(ownerA)).resolves.toMatchObject({
      state: SubscriptionState.Expired,
      daysLeft: 0,
    });
  });

  it('fails when the business has no subscription', async () => {
    await expect(
      get.execute({ ...ownerA, tenantId: 'tenant-c' }),
    ).rejects.toThrow(SubscriptionNotFoundError);
  });

  describe('choosing a plan', () => {
    it('saves the choice for the caller’s business only', async () => {
      const view = await choose.execute(ownerA, PlanCode.Starter);

      expect(view.plan.code).toBe(PlanCode.Starter);
      await expect(get.execute(ownerA)).resolves.toMatchObject({
        plan: { code: PlanCode.Starter },
      });
      await expect(get.execute(ownerB)).resolves.toMatchObject({
        plan: { code: PlanCode.Pro },
      });
    });

    it('still works after the trial ended, so the business can pick a plan', async () => {
      clock.advanceDays(30);

      const view = await choose.execute(ownerA, PlanCode.Business);

      expect(view.plan.code).toBe(PlanCode.Business);
      expect(view.state).toBe(SubscriptionState.Expired);
    });

    it('rejects an unknown plan', async () => {
      await expect(choose.execute(ownerA, 'FREE' as PlanCode)).rejects.toThrow(
        UnknownPlanError,
      );
    });

    it('fails when the business has no subscription', async () => {
      await expect(
        choose.execute({ ...ownerA, tenantId: 'tenant-c' }, PlanCode.Pro),
      ).rejects.toThrow(SubscriptionNotFoundError);
    });
  });

  describe('access', () => {
    it('lets a business in its trial change data', async () => {
      await expect(assertAccess.execute('tenant-a')).resolves.toBeUndefined();
    });

    it('blocks a business whose trial ended, and only that one', async () => {
      clock.advanceDays(7);
      await subscriptions.save(
        Subscription.startTrial(
          { id: 'sub-fresh', tenantId: 'tenant-fresh' },
          clock.now(),
        ),
      );

      await expect(assertAccess.execute('tenant-a')).rejects.toThrow(
        SubscriptionExpiredError,
      );
      await expect(
        assertAccess.execute('tenant-fresh'),
      ).resolves.toBeUndefined();
    });

    it('does not restrict a business that has no subscription row', async () => {
      await expect(
        assertAccess.execute('hand-made-tenant'),
      ).resolves.toBeUndefined();
    });
  });
});
