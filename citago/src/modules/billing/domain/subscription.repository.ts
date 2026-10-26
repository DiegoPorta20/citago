import type { Subscription } from './subscription.entity.js';

export abstract class SubscriptionRepository {
  abstract findByTenant(tenantId: string): Promise<Subscription | null>;

  /**
   * The one lookup that is not scoped by tenant: a gateway webhook only knows
   * the gateway's id. It is used to *find* whose it is, never to trust the
   * caller (the webhook only triggers a re-read from the gateway).
   */
  abstract findByGatewaySubscriptionId(
    id: string,
  ): Promise<Subscription | null>;

  /**
   * Subscriptions whose trial or paid period ended recently or ends soon:
   * the ones worth a reminder. The caller decides which reminder fits.
   */
  abstract findNearBoundary(
    now: Date,
    lookbackDays: number,
    lookaheadDays: number,
  ): Promise<Subscription[]>;

  abstract save(subscription: Subscription): Promise<void>;
}
