import type { Subscription } from './subscription.entity.js';

export abstract class SubscriptionRepository {
  abstract findByTenant(tenantId: string): Promise<Subscription | null>;

  abstract save(subscription: Subscription): Promise<void>;
}
