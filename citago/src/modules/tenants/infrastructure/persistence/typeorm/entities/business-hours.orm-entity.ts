import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { TenantOrmEntity } from './tenant.orm-entity.js';

/**
 * One opening range of one weekday.
 *
 * Local wall-clock time of the business, never UTC (rule TZ-3): a shop opens at
 * nine o'clock on its own clock, and that does not move when daylight saving
 * does.
 */
@Entity('business_hours')
@Index('ix_business_hours_tenant', ['tenantId', 'weekday'])
export class BusinessHoursOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'weekday', type: 'tinyint', unsigned: true })
  weekday: number;

  /** Returned by MySQL as `HH:mm:ss`. */
  @Column({ name: 'starts_at', type: 'time' })
  startsAt: string;

  @Column({ name: 'ends_at', type: 'time' })
  endsAt: string;

  @ManyToOne(() => TenantOrmEntity, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_business_hours_tenant',
  })
  tenant?: TenantOrmEntity;
}
