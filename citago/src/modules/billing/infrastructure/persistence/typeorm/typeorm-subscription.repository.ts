import { Injectable } from '@nestjs/common';

import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { Subscription } from '../../../domain/subscription.entity.js';
import { SubscriptionRepository } from '../../../domain/subscription.repository.js';
import { SubscriptionOrmEntity } from './entities/subscription.orm-entity.js';

@Injectable()
export class TypeOrmSubscriptionRepository extends SubscriptionRepository {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get repository() {
    return this.context.manager.getRepository(SubscriptionOrmEntity);
  }

  async findByTenant(tenantId: string): Promise<Subscription | null> {
    const row = await this.repository.findOneBy({ tenantId });

    return row
      ? Subscription.restore({
          id: row.id,
          tenantId: row.tenantId,
          planCode: row.planCode,
          trialEndsAt: row.trialEndsAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })
      : null;
  }

  async save(subscription: Subscription): Promise<void> {
    const row = new SubscriptionOrmEntity();

    Object.assign(row, subscription.toSnapshot());

    await this.repository.save(row);
  }
}
