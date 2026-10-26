import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { SubscriptionOrmEntity } from './subscription.orm-entity.js';

/**
 * One row per reminder already sent (or being sent), so a restart, a second
 * instance or a retry never emails the same person twice about the same thing.
 */
@Entity('subscription_notices')
@Unique('uq_subscription_notices_once', ['subscriptionId', 'kind', 'ref'])
export class SubscriptionNoticeOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'subscription_id', type: 'char', length: 36 })
  subscriptionId: string;

  @Column({ name: 'kind', type: 'varchar', length: 32 })
  kind: string;

  /** What the notice is about: `trial`, or the period end date it refers to. */
  @Column({ name: 'ref', type: 'varchar', length: 32 })
  ref: string;

  @Column({ name: 'sent_at', type: 'datetime', precision: 3 })
  sentAt: Date;

  @ManyToOne(() => SubscriptionOrmEntity, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'subscription_id',
    foreignKeyConstraintName: 'fk_subscription_notices_subscription',
  })
  subscription?: SubscriptionOrmEntity;
}
