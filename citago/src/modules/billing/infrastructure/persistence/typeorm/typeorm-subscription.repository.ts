import { Injectable } from '@nestjs/common';
import { Between, IsNull, Not } from 'typeorm';

import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { Subscription } from '../../../domain/subscription.entity.js';
import { SubscriptionRepository } from '../../../domain/subscription.repository.js';
import { SubscriptionOrmEntity } from './entities/subscription.orm-entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;

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

    return row ? this.toDomain(row) : null;
  }

  async findByGatewaySubscriptionId(id: string): Promise<Subscription | null> {
    const row = await this.repository.findOneBy({ gatewaySubscriptionId: id });

    return row ? this.toDomain(row) : null;
  }

  async findNearBoundary(
    now: Date,
    lookbackDays: number,
    lookaheadDays: number,
  ): Promise<Subscription[]> {
    const window = Between(
      new Date(now.getTime() - lookbackDays * DAY_MS),
      new Date(now.getTime() + lookaheadDays * DAY_MS),
    );
    const rows = await this.repository.find({
      where: [
        // On the trial, never paid.
        { currentPeriodEnd: IsNull(), trialEndsAt: window },
        // Paying (or was), with a period ending around now.
        { currentPeriodEnd: window, gatewaySubscriptionId: Not(IsNull()) },
      ],
      order: { createdAt: 'ASC' },
    });

    return rows.map((row) => this.toDomain(row));
  }

  async save(subscription: Subscription): Promise<void> {
    const row = new SubscriptionOrmEntity();

    Object.assign(row, subscription.toSnapshot());

    await this.repository.save(row);
  }

  private toDomain(row: SubscriptionOrmEntity): Subscription {
    return Subscription.restore({
      id: row.id,
      tenantId: row.tenantId,
      planCode: row.planCode,
      trialEndsAt: row.trialEndsAt,
      gatewaySubscriptionId: row.gatewaySubscriptionId,
      gatewayCustomerId: row.gatewayCustomerId,
      currentPeriodEnd: row.currentPeriodEnd,
      canceledAt: row.canceledAt,
      lastSyncedAt: row.lastSyncedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
