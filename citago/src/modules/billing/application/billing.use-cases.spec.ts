import {
  FakePaymentProvider,
  FixedPaymentSettings,
  InMemorySubscriptionRepository,
} from '../../../../test/support/fakes/billing.fakes.js';
import {
  FixedClock,
  ImmediateTransactionRunner,
  InMemoryTenantRepository,
} from '../../../../test/support/fakes/identity.fakes.js';
import { FakeHandoffTokens } from '../../../../test/support/fakes/whatsapp.fakes.js';
import type { AuthContext } from '../../../shared/application/auth-context.js';
import type { HandoffClaims } from '../../../shared/application/ports/handoff-tokens.port.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { BusinessType } from '../../tenants/domain/business-type.js';
import { Tenant } from '../../tenants/domain/tenant.entity.js';
import {
  AlreadySubscribedError,
  NotPayingError,
  PaymentDeclinedError,
  PaymentsNotConfiguredError,
  PaymentUnavailableError,
  PlanChangeRequiresPaymentError,
  SubscriptionExpiredError,
  SubscriptionNotFoundError,
  UnknownPlanError,
} from '../domain/billing.errors.js';
import { PLANS, PlanCode } from '../domain/plan.js';
import {
  GRACE_DAYS,
  Subscription,
  SubscriptionState,
} from '../domain/subscription.entity.js';
import {
  AssertSubscriptionAccessUseCase,
  CancelSubscriptionUseCase,
  ChoosePlanUseCase,
  CompleteCheckoutUseCase,
  GetCheckoutConfigUseCase,
  GetSubscriptionUseCase,
  HandleGatewayEventUseCase,
  ListPlansUseCase,
  StartCheckoutUseCase,
  SubscriptionSync,
} from './billing.use-cases.js';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const ownerA: AuthContext = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  membershipId: 'membership-a',
  role: UserRole.Owner,
};
const ownerB: AuthContext = { ...ownerA, tenantId: 'tenant-b' };

const checkoutClaims = (
  plan: PlanCode,
  tenantId = 'tenant-a',
): HandoffClaims => ({
  tenantId,
  userId: 'user-a',
  purpose: 'checkout',
  subject: plan,
});

describe('Billing use cases', () => {
  let subscriptions: InMemorySubscriptionRepository;
  let provider: FakePaymentProvider;
  let settings: FixedPaymentSettings;
  let clock: FixedClock;
  let tenants: InMemoryTenantRepository;
  let tokens: FakeHandoffTokens;

  let sync: SubscriptionSync;
  let get: GetSubscriptionUseCase;
  let choose: ChoosePlanUseCase;
  let assertAccess: AssertSubscriptionAccessUseCase;
  let startCheckout: StartCheckoutUseCase;
  let checkoutConfig: GetCheckoutConfigUseCase;
  let completeCheckout: CompleteCheckoutUseCase;
  let cancel: CancelSubscriptionUseCase;
  let handleEvent: HandleGatewayEventUseCase;

  const build = (enabled = true) => {
    settings = new FixedPaymentSettings(enabled);
    sync = new SubscriptionSync(subscriptions, provider, clock);
    get = new GetSubscriptionUseCase(subscriptions, sync, settings, clock);
    choose = new ChoosePlanUseCase(
      subscriptions,
      new ImmediateTransactionRunner(),
      settings,
      clock,
    );
    assertAccess = new AssertSubscriptionAccessUseCase(
      subscriptions,
      sync,
      clock,
    );
    startCheckout = new StartCheckoutUseCase(
      subscriptions,
      settings,
      tokens,
      clock,
    );
    checkoutConfig = new GetCheckoutConfigUseCase(settings);
    completeCheckout = new CompleteCheckoutUseCase(
      subscriptions,
      tenants,
      provider,
      settings,
      new ImmediateTransactionRunner(),
      clock,
    );
    cancel = new CancelSubscriptionUseCase(
      subscriptions,
      provider,
      settings,
      clock,
    );
    handleEvent = new HandleGatewayEventUseCase(subscriptions, sync);
  };

  const trial = (tenantId: string) =>
    subscriptions.save(
      Subscription.startTrial({ id: `sub-${tenantId}`, tenantId }, NOW),
    );

  /** Pays through the real checkout use case and returns the gateway id. */
  const pay = async (plan = PlanCode.Pro, tenantId = 'tenant-a') => {
    await completeCheckout.execute(checkoutClaims(plan, tenantId), {
      cardToken: 'tkn_ok',
      email: 'dueno@barberia.pe',
    });

    return (await subscriptions.findByTenant(tenantId))
      ?.gatewaySubscriptionId as string;
  };

  beforeEach(async () => {
    subscriptions = new InMemorySubscriptionRepository();
    clock = new FixedClock(NOW);
    provider = new FakePaymentProvider(() => clock.now());
    tenants = new InMemoryTenantRepository();
    tokens = new FakeHandoffTokens();
    build();

    for (const tenantId of ['tenant-a', 'tenant-b']) {
      await trial(tenantId);
      tenants.tenants.set(
        tenantId,
        Tenant.create(
          {
            id: tenantId,
            name: `Barbería ${tenantId}`,
            slug: tenantId,
            businessType: BusinessType.Barbershop,
            country: 'PE',
            currency: 'PEN',
            timezone: 'America/Lima',
          },
          NOW,
        ),
      );
    }
  });

  it('lists the three plans', () => {
    expect(new ListPlansUseCase().execute()).toBe(PLANS);
  });

  describe('reading the subscription', () => {
    it('describes the trial of the caller’s business', async () => {
      const view = await get.execute(ownerA);

      expect(view).toMatchObject({
        state: SubscriptionState.Trialing,
        daysLeft: 7,
        renews: false,
        currentPeriodEnd: null,
        paymentsEnabled: true,
        plan: { code: PlanCode.Pro },
      });
    });

    it('says when online payment is not available', async () => {
      build(false);

      await expect(get.execute(ownerA)).resolves.toMatchObject({
        paymentsEnabled: false,
      });
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
  });

  describe('choosing a plan', () => {
    it('saves the choice for the caller’s business only', async () => {
      const view = await choose.execute(ownerA, PlanCode.Starter);

      expect(view.plan.code).toBe(PlanCode.Starter);
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

    it('is refused while paying: the plan changes by paying for the new one', async () => {
      await pay();

      await expect(choose.execute(ownerA, PlanCode.Starter)).rejects.toThrow(
        PlanChangeRequiresPaymentError,
      );
    });

    it('is allowed again once the renewal was cancelled', async () => {
      await pay();
      await cancel.execute(ownerA);

      await expect(
        choose.execute(ownerA, PlanCode.Starter),
      ).resolves.toBeDefined();
    });
  });

  describe('starting a checkout', () => {
    it('hands out a link with a token for this business, plan and purpose only', async () => {
      const { url, expiresInSeconds } = await startCheckout.execute(
        ownerA,
        PlanCode.Business,
      );
      const [page, fragment] = url.split('#');
      const token = new URLSearchParams(fragment).get('t') ?? '';

      expect(page).toBe('https://api.citago.test/api/v1/pages/checkout');
      expect(expiresInSeconds).toBe(900);
      expect(tokens.verify(token, 'checkout')).toEqual({
        tenantId: 'tenant-a',
        userId: 'user-a',
        purpose: 'checkout',
        subject: PlanCode.Business,
      });
      expect(tokens.verify(token, 'whatsapp-signup')).toBeNull();
    });

    it('defaults to the plan already chosen', async () => {
      await choose.execute(ownerA, PlanCode.Starter);

      const { url } = await startCheckout.execute(ownerA);
      const token = new URLSearchParams(url.split('#')[1]).get('t') ?? '';

      expect(tokens.verify(token, 'checkout')?.subject).toBe(PlanCode.Starter);
    });

    it('is unavailable until payments are configured', async () => {
      build(false);

      await expect(startCheckout.execute(ownerA)).rejects.toThrow(
        PaymentsNotConfiguredError,
      );
    });

    it('refuses to charge twice for the plan that is already paid and active', async () => {
      await pay(PlanCode.Pro);

      await expect(startCheckout.execute(ownerA, PlanCode.Pro)).rejects.toThrow(
        AlreadySubscribedError,
      );
    });

    it('lets a paying business move to another plan', async () => {
      await pay(PlanCode.Pro);

      await expect(
        startCheckout.execute(ownerA, PlanCode.Business),
      ).resolves.toBeDefined();
    });

    it('lets a business whose renewal failed pay again for the same plan', async () => {
      await pay(PlanCode.Pro);
      clock.advanceDays(31);

      await expect(
        startCheckout.execute(ownerA, PlanCode.Pro),
      ).resolves.toBeDefined();
    });
  });

  describe('the checkout page', () => {
    it('receives the public key and the plan the link was issued for', () => {
      const config = checkoutConfig.execute(checkoutClaims(PlanCode.Starter));

      expect(config.publicKey).toBe('pk_test_fixed');
      expect(config.plan.code).toBe(PlanCode.Starter);
    });

    it('refuses a link with no plan in it', () => {
      expect(() =>
        checkoutConfig.execute({
          ...checkoutClaims(PlanCode.Pro),
          subject: undefined,
        }),
      ).toThrow(UnknownPlanError);
    });

    it('is unavailable until payments are configured', () => {
      build(false);

      expect(() =>
        checkoutConfig.execute(checkoutClaims(PlanCode.Pro)),
      ).toThrow(PaymentsNotConfiguredError);
    });
  });

  describe('completing the payment', () => {
    it('turns the trial into an active, renewing subscription on the paid plan', async () => {
      const view = await completeCheckout.execute(
        checkoutClaims(PlanCode.Business),
        { cardToken: 'tkn_ok', email: 'dueno@barberia.pe' },
      );

      expect(view).toMatchObject({
        state: SubscriptionState.Active,
        renews: true,
        plan: { code: PlanCode.Business },
      });
      expect(view.currentPeriodEnd).toEqual(
        new Date(NOW.getTime() + 30 * DAY_MS),
      );
      expect(provider.calls).toEqual(['subscribe:BUSINESS:tkn_ok']);

      const saved = await subscriptions.findByTenant('tenant-a');

      expect(saved?.gatewaySubscriptionId).toBe('sxn_1');
      expect(saved?.gatewayCustomerId).toBe('cus_1');
    });

    it('charges the plan in the link, whatever else was chosen meanwhile', async () => {
      await choose.execute(ownerA, PlanCode.Starter);

      const view = await completeCheckout.execute(
        checkoutClaims(PlanCode.Business),
        { cardToken: 'tkn_ok', email: 'dueno@barberia.pe' },
      );

      expect(view.plan.code).toBe(PlanCode.Business);
    });

    it('pays for the business named in the token and no other', async () => {
      await pay(PlanCode.Pro, 'tenant-a');

      await expect(get.execute(ownerB)).resolves.toMatchObject({
        state: SubscriptionState.Trialing,
        renews: false,
      });
    });

    it('does not charge again on a double tap or a second tab', async () => {
      await pay();

      await expect(
        completeCheckout.execute(checkoutClaims(PlanCode.Pro), {
          cardToken: 'tkn_other',
          email: 'dueno@barberia.pe',
        }),
      ).rejects.toThrow(AlreadySubscribedError);
      expect(
        provider.calls.filter((c) => c.startsWith('subscribe')),
      ).toHaveLength(1);
    });

    it('leaves the trial untouched when the card is declined', async () => {
      provider.failNext('DECLINED', 'Tarjeta sin fondos.');

      const failure = await completeCheckout
        .execute(checkoutClaims(PlanCode.Pro), {
          cardToken: 'tkn_bad',
          email: 'dueno@barberia.pe',
        })
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(PaymentDeclinedError);
      expect((failure as PaymentDeclinedError).message).toBe(
        'Tarjeta sin fondos.',
      );
      await expect(get.execute(ownerA)).resolves.toMatchObject({
        state: SubscriptionState.Trialing,
        renews: false,
      });
    });

    it('treats a card token the gateway refused like a declined card', async () => {
      provider.failNext('REJECTED');

      await expect(
        completeCheckout.execute(checkoutClaims(PlanCode.Pro), {
          cardToken: 'tkn_used',
          email: 'dueno@barberia.pe',
        }),
      ).rejects.toThrow(PaymentDeclinedError);
    });

    it('reports a gateway outage without blaming the card', async () => {
      provider.failNext('UNAVAILABLE');

      await expect(
        completeCheckout.execute(checkoutClaims(PlanCode.Pro), {
          cardToken: 'tkn_ok',
          email: 'dueno@barberia.pe',
        }),
      ).rejects.toThrow(PaymentUnavailableError);
    });

    it('reports bad credentials as payments not configured, not as a customer error', async () => {
      provider.failNext('MISCONFIGURED');

      await expect(
        completeCheckout.execute(checkoutClaims(PlanCode.Pro), {
          cardToken: 'tkn_ok',
          email: 'dueno@barberia.pe',
        }),
      ).rejects.toThrow(PaymentsNotConfiguredError);
    });

    it('refuses until payments are configured', async () => {
      build(false);

      await expect(
        completeCheckout.execute(checkoutClaims(PlanCode.Pro), {
          cardToken: 'tkn_ok',
          email: 'dueno@barberia.pe',
        }),
      ).rejects.toThrow(PaymentsNotConfiguredError);
      expect(provider.calls).toEqual([]);
    });

    it('cancels the old subscription when the plan changes, so nobody pays twice', async () => {
      const first = await pay(PlanCode.Pro);

      const view = await completeCheckout.execute(
        checkoutClaims(PlanCode.Business),
        { cardToken: 'tkn_ok2', email: 'dueno@barberia.pe' },
      );

      expect(view.plan.code).toBe(PlanCode.Business);
      expect(provider.calls).toContain(`cancel:${first}`);
      expect(provider.remote.get(first)?.canceled).toBe(true);
      expect(
        (await subscriptions.findByTenant('tenant-a'))?.gatewaySubscriptionId,
      ).not.toBe(first);
    });

    it('reuses the customer it already created at the gateway', async () => {
      await pay(PlanCode.Pro);
      clock.advanceDays(31);
      const calls: unknown[] = [];
      const original = provider.subscribe.bind(provider);

      provider.subscribe = async (input) => {
        calls.push(input.customer.existingCustomerId);

        return original(input);
      };

      await completeCheckout.execute(checkoutClaims(PlanCode.Pro), {
        cardToken: 'tkn_ok3',
        email: 'dueno@barberia.pe',
      });

      expect(calls).toEqual(['cus_1']);
    });

    it('falls back to a month when the gateway does not say when it charges next', async () => {
      const original = provider.subscribe.bind(provider);

      provider.subscribe = async (input) => ({
        ...(await original(input)),
        periodEnd: null,
      });

      const view = await completeCheckout.execute(
        checkoutClaims(PlanCode.Pro),
        { cardToken: 'tkn_ok', email: 'dueno@barberia.pe' },
      );

      expect(view.currentPeriodEnd).toEqual(
        new Date(NOW.getTime() + 31 * DAY_MS),
      );
    });
  });

  describe('cancelling', () => {
    it('stops the renewal at the gateway and keeps the paid period usable', async () => {
      const id = await pay();

      const view = await cancel.execute(ownerA);

      expect(provider.calls).toContain(`cancel:${id}`);
      expect(view).toMatchObject({
        renews: false,
        state: SubscriptionState.Active,
      });
    });

    it('has nothing to cancel on a trial, or twice', async () => {
      await expect(cancel.execute(ownerA)).rejects.toThrow(NotPayingError);

      await pay();
      await cancel.execute(ownerA);

      await expect(cancel.execute(ownerA)).rejects.toThrow(NotPayingError);
    });

    it('stays renewing if the gateway could not be told', async () => {
      await pay();
      provider.failNext('UNAVAILABLE');

      await expect(cancel.execute(ownerA)).rejects.toThrow(
        PaymentUnavailableError,
      );
      await expect(get.execute(ownerA)).resolves.toMatchObject({
        renews: true,
      });
    });

    it('only touches the caller’s own business', async () => {
      await pay(PlanCode.Pro, 'tenant-a');

      await expect(cancel.execute(ownerB)).rejects.toThrow(NotPayingError);
    });
  });

  describe('noticing renewals (the gateway charges on its own)', () => {
    const dayAfterPeriod = () => clock.advanceDays(31);

    it('does not ask the gateway while the paid period runs', async () => {
      await pay();
      provider.calls.length = 0;

      await assertAccess.execute('tenant-a');
      await get.execute(ownerA);

      expect(provider.calls).toEqual([]);
    });

    it('recovers by itself when the renewal went through unannounced', async () => {
      const id = await pay();

      dayAfterPeriod();
      provider.renew(id, new Date(clock.now().getTime() + 30 * DAY_MS));

      await expect(assertAccess.execute('tenant-a')).resolves.toBeUndefined();
      await expect(get.execute(ownerA)).resolves.toMatchObject({
        state: SubscriptionState.Active,
      });
    });

    it('also recovers when the app merely opens and reads the plan', async () => {
      const id = await pay();

      dayAfterPeriod();
      provider.renew(id, new Date(clock.now().getTime() + 30 * DAY_MS));

      await expect(get.execute(ownerA)).resolves.toMatchObject({
        state: SubscriptionState.Active,
      });
    });

    it('stays past due, still working, while the renewal keeps failing', async () => {
      await pay();
      dayAfterPeriod();

      await expect(get.execute(ownerA)).resolves.toMatchObject({
        state: SubscriptionState.PastDue,
      });
      await expect(assertAccess.execute('tenant-a')).resolves.toBeUndefined();
    });

    it('blocks writes once the grace ended without a payment', async () => {
      await pay();
      clock.advanceDays(30 + GRACE_DAYS + 1);

      await expect(assertAccess.execute('tenant-a')).rejects.toThrow(
        SubscriptionExpiredError,
      );
    });

    it('asks again only after the cooldown, however many requests arrive', async () => {
      await pay();
      dayAfterPeriod();
      provider.calls.length = 0;

      await assertAccess.execute('tenant-a');
      await assertAccess.execute('tenant-a');
      await get.execute(ownerA);
      expect(provider.calls.filter((c) => c.startsWith('fetch'))).toHaveLength(
        1,
      );

      clock.advanceDays(0.01);
      await assertAccess.execute('tenant-a');
      expect(provider.calls.filter((c) => c.startsWith('fetch'))).toHaveLength(
        2,
      );
    });

    it('never blocks work because the gateway is down', async () => {
      await pay();
      dayAfterPeriod();
      provider.failNext('UNAVAILABLE');

      await expect(assertAccess.execute('tenant-a')).resolves.toBeUndefined();
      await expect(get.execute(ownerA)).resolves.toMatchObject({
        state: SubscriptionState.PastDue,
      });
    });

    it('treats a subscription the gateway forgot as cancelled: no grace, no renewal', async () => {
      const id = await pay();

      dayAfterPeriod();
      provider.remove(id);
      await get.execute(ownerA);

      await expect(get.execute(ownerA)).resolves.toMatchObject({
        renews: false,
        state: SubscriptionState.Expired,
      });
    });
  });

  describe('a gateway notification', () => {
    it('re-reads the subscription it names and applies what the gateway says', async () => {
      const id = await pay();

      clock.advanceDays(31);
      provider.renew(id, new Date(clock.now().getTime() + 30 * DAY_MS));
      await handleEvent.execute(id);

      expect(
        (await subscriptions.findByTenant('tenant-a'))?.stateAt(clock.now()),
      ).toBe(SubscriptionState.Active);
    });

    it('is harmless when repeated', async () => {
      const id = await pay();

      await handleEvent.execute(id);
      const once = (await subscriptions.findByTenant('tenant-a'))
        ?.currentPeriodEnd;
      await handleEvent.execute(id);

      expect(
        (await subscriptions.findByTenant('tenant-a'))?.currentPeriodEnd,
      ).toEqual(once);
    });

    it('ignores a subscription that is not ours', async () => {
      await expect(handleEvent.execute('sxn_unknown')).resolves.toBeUndefined();
      expect(provider.calls).toEqual([]);
    });

    it('fails when the gateway is unreachable, so the delivery is retried', async () => {
      const id = await pay();

      provider.failNext('UNAVAILABLE');

      await expect(handleEvent.execute(id)).rejects.toThrow(
        PaymentUnavailableError,
      );
    });
  });
});
