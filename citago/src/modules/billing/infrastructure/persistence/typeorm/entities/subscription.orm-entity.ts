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
export class SubscriptionOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'plan_code', type: 'enum', enum: PlanCode })
  planCode: PlanCode;

  @Column({ name: 'trial_ends_at', type: 'datetime', precision: 3 })
  trialEndsAt: Date;

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
