import { jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { InMemorySubscriptionRepository } from '../../../../test/support/fakes/billing.fakes.js';
import { FixedClock } from '../../../../test/support/fakes/identity.fakes.js';
import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { AUTH_CONTEXT_PROPERTY } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { AssertSubscriptionAccessUseCase } from '../application/billing.use-cases.js';
import { SubscriptionExpiredError } from '../domain/billing.errors.js';
import { Subscription } from '../domain/subscription.entity.js';
import { SubscriptionGuard } from './subscription.guard.js';

const NOW = new Date('2026-10-23T12:00:00.000Z');

const owner: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  role: UserRole.Owner,
};

async function setup(options: {
  expired: boolean;
  allowWhenExpired?: boolean;
}) {
  const subscriptions = new InMemorySubscriptionRepository();
  const clock = new FixedClock(NOW);

  await subscriptions.save(
    Subscription.startTrial({ id: 'sub-1', tenantId: owner.tenantId }, NOW),
  );

  if (options.expired) {
    clock.advanceDays(8);
  }

  const reflector = new Reflector();

  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockReturnValue(options.allowWhenExpired ?? false);

  const guard = new SubscriptionGuard(
    reflector,
    new AssertSubscriptionAccessUseCase(subscriptions, clock),
  );

  const contextFor = (method: string, auth: AuthContext | null = owner) =>
    ({
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          [AUTH_CONTEXT_PROPERTY]: auth ?? undefined,
        }),
      }),
    }) as unknown as ExecutionContext;

  return { guard, contextFor };
}

describe('SubscriptionGuard', () => {
  it('lets a business in its trial write', async () => {
    const { guard, contextFor } = await setup({ expired: false });

    await expect(guard.canActivate(contextFor('POST'))).resolves.toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'blocks %s once the trial ended, with 402-category SUBSCRIPTION_EXPIRED',
    async (method) => {
      const { guard, contextFor } = await setup({ expired: true });

      await expect(guard.canActivate(contextFor(method))).rejects.toThrow(
        SubscriptionExpiredError,
      );
    },
  );

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'still lets %s through after the trial ended: the data stays readable',
    async (method) => {
      const { guard, contextFor } = await setup({ expired: true });

      await expect(guard.canActivate(contextFor(method))).resolves.toBe(true);
    },
  );

  it('lets an endpoint marked @AllowWhenExpired through, so a plan can be chosen', async () => {
    const { guard, contextFor } = await setup({
      expired: true,
      allowWhenExpired: true,
    });

    await expect(guard.canActivate(contextFor('PUT'))).resolves.toBe(true);
  });

  it('does nothing on a route without a session (a @Public route)', async () => {
    const { guard, contextFor } = await setup({ expired: true });

    await expect(guard.canActivate(contextFor('POST', null))).resolves.toBe(
      true,
    );
  });
});
