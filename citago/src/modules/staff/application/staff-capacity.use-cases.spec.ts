import { InMemorySubscriptionRepository } from '../../../../test/support/fakes/billing.fakes.js';
import { InMemoryStaffRepository } from '../../../../test/support/fakes/staff.fakes.js';
import {
  FixedClock,
  SequentialIdGenerator,
} from '../../../../test/support/fakes/identity.fakes.js';
import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { PlanStaffCapacity } from '../../billing/application/plan-staff-capacity.js';
import { StaffLimitReachedError } from '../../billing/domain/billing.errors.js';
import { PlanCode } from '../../billing/domain/plan.js';
import { Subscription } from '../../billing/domain/subscription.entity.js';
import { StaffMemberStatus } from '../domain/staff-member-status.js';
import {
  CreateStaffMemberUseCase,
  SetStaffMemberStatusUseCase,
} from './staff-member.use-cases.js';
import type { StaffUserLinkValidator } from './staff-user-link.validator.js';

const NOW = new Date('2026-10-24T12:00:00.000Z');

const ownerA: AuthContext = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  membershipId: 'membership-a',
  role: UserRole.Owner,
};
const ownerB: AuthContext = { ...ownerA, tenantId: 'tenant-b' };

describe('Professionals per plan (BI-7)', () => {
  let staff: InMemoryStaffRepository;
  let subscriptions: InMemorySubscriptionRepository;
  let create: CreateStaffMemberUseCase;
  let setStatus: SetStaffMemberStatusUseCase;

  const useStarter = async (tenantId = 'tenant-a') => {
    const subscription = await subscriptions.findByTenant(tenantId);

    subscription?.choosePlan(PlanCode.Starter, NOW);
  };

  const hire = async (actor: AuthContext, count: number) => {
    for (let i = 0; i < count; i += 1) {
      await create.execute(actor, { displayName: `Barbero ${i}` });
    }
  };

  beforeEach(async () => {
    staff = new InMemoryStaffRepository();
    subscriptions = new InMemorySubscriptionRepository();

    for (const tenantId of ['tenant-a', 'tenant-b']) {
      await subscriptions.save(
        Subscription.startTrial({ id: `sub-${tenantId}`, tenantId }, NOW),
      );
    }

    const capacity = new PlanStaffCapacity(subscriptions);
    const clock = new FixedClock(NOW);

    create = new CreateStaffMemberUseCase(
      staff,
      {
        assertLinkable: async () => undefined,
      } as unknown as StaffUserLinkValidator,
      capacity,
      new SequentialIdGenerator(),
      clock,
    );
    setStatus = new SetStaffMemberStatusUseCase(staff, capacity, clock);
  });

  it('lets a business on the default Pro plan have 5 and refuses the 6th', async () => {
    await hire(ownerA, 5);

    await expect(
      create.execute(ownerA, { displayName: 'Sexto' }),
    ).rejects.toThrow(StaffLimitReachedError);
    await expect(staff.countActive('tenant-a')).resolves.toBe(5);
  });

  it('applies the limit of the plan the business chose', async () => {
    await useStarter();
    await hire(ownerA, 2);

    await expect(
      create.execute(ownerA, { displayName: 'Tercero' }),
    ).rejects.toThrow(StaffLimitReachedError);
  });

  it('names the plan and the limit so the app can tell the owner what to do', async () => {
    await useStarter();
    await hire(ownerA, 2);

    const failure = await create
      .execute(ownerA, { displayName: 'Tercero' })
      .catch((error: StaffLimitReachedError) => error);

    expect(failure).toMatchObject({
      code: 'STAFF_LIMIT_REACHED',
      details: { planCode: 'STARTER', limit: 2 },
    });
  });

  it('counts each business on its own', async () => {
    await hire(ownerA, 5);

    await expect(
      create.execute(ownerB, { displayName: 'Otro negocio' }),
    ).resolves.toBeDefined();
  });

  it('frees a place when a professional is deactivated', async () => {
    await useStarter();
    await hire(ownerA, 2);
    const [first] = await staff.list('tenant-a');

    await setStatus.execute(ownerA, {
      staffMemberId: first.id,
      status: StaffMemberStatus.Inactive,
    });

    await expect(
      create.execute(ownerA, { displayName: 'Reemplazo' }),
    ).resolves.toBeDefined();
  });

  it('refuses to reactivate someone when the plan is full', async () => {
    await useStarter();
    await hire(ownerA, 2);
    const [first] = await staff.list('tenant-a');
    await setStatus.execute(ownerA, {
      staffMemberId: first.id,
      status: StaffMemberStatus.Inactive,
    });
    await create.execute(ownerA, { displayName: 'Reemplazo' });

    await expect(
      setStatus.execute(ownerA, {
        staffMemberId: first.id,
        status: StaffMemberStatus.Active,
      }),
    ).rejects.toThrow(StaffLimitReachedError);
  });

  it('does not refuse "activating" someone who is already active, even at the limit', async () => {
    await useStarter();
    await hire(ownerA, 2);
    const [first] = await staff.list('tenant-a');

    await expect(
      setStatus.execute(ownerA, {
        staffMemberId: first.id,
        status: StaffMemberStatus.Active,
      }),
    ).resolves.toBeDefined();
  });

  it('never deactivates professionals a business already has when it moves to a smaller plan', async () => {
    await hire(ownerA, 4);
    await useStarter();

    await expect(staff.countActive('tenant-a')).resolves.toBe(4);
    await expect(
      create.execute(ownerA, { displayName: 'Quinto' }),
    ).rejects.toThrow(StaffLimitReachedError);
  });

  it('does not restrict a business without a subscription row', async () => {
    await expect(
      create.execute(
        { ...ownerA, tenantId: 'hand-made' },
        { displayName: 'Sin suscripción' },
      ),
    ).resolves.toBeDefined();
  });
});
