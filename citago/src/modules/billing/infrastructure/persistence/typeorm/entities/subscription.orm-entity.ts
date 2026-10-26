import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { TenantOrmEntity } from '../../../../../tenants/infrastructure/persistence/typeorm/entities/tenant.orm-entity.js';
import { PlanCode } from '../../../../domain/plan.js';

@Entity('subscriptions')
@Unique('uq_subscriptions_tenant', ['tenantId'])
@Unique('uq_subscriptions_gateway_subscription', ['gatewaySubscriptionId'])
export class SubscriptionOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'plan_code', type: 'enum', enum: PlanCode })
  planCode: PlanCode;

  @Column({ name: 'trial_ends_at', type: 'datetime', precision: 3 })
  trialEndsAt: Date;

  @Column({
    name: 'gateway_subscription_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  gatewaySubscriptionId: string | null;

  @Column({
    name: 'gateway_customer_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  gatewayCustomerId: string | null;

  @Column({
    name: 'current_period_end',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  currentPeriodEnd: Date | null;

  @Column({
    name: 'canceled_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  canceledAt: Date | null;

  @Column({
    name: 'last_synced_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastSyncedAt: Date | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @ManyToOne(() => TenantOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_subscriptions_tenant',
  })
  tenant?: TenantOrmEntity;
}
