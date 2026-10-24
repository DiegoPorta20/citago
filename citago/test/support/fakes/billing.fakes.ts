import type { Subscription } from '../../../src/modules/billing/domain/subscription.entity.js';
import { SubscriptionRepository } from '../../../src/modules/billing/domain/subscription.repository.js';

export class InMemorySubscriptionRepository extends SubscriptionRepository {
  readonly subscriptions = new Map<string, Subscription>();

  async findByTenant(tenantId: string): Promise<Subscription | null> {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.tenantId === tenantId) {
        return subscription;
      }
    }

    return null;
  }

  async save(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.id, subscription);
  }
}
