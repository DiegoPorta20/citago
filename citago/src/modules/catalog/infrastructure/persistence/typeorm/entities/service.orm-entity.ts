import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { TenantOrmEntity } from '../../../../../tenants/infrastructure/persistence/typeorm/entities/tenant.orm-entity.js';
import { ServiceStatus } from '../../../../domain/service-status.js';

@Entity('services')
/**
 * Target of the composite foreign keys that appointments and sale items will
 * use: `(tenant_id, service_id) → services(tenant_id, id)`. That is what makes
 * a cross-tenant reference impossible at the database level (ADR 0004).
 */
@Unique('uq_services_tenant_id', ['tenantId', 'id'])
@Index('ix_services_tenant_status_name', ['tenantId', 'status', 'name'])
export class ServiceOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'duration_minutes', type: 'smallint', unsigned: true })
  durationMinutes: number;

  /**
   * Read and written as a string: `bigNumberStrings` keeps DECIMAL out of JS
   * floating point, and the domain turns it into `Money`.
   */
  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2 })
  price: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ServiceStatus,
    default: ServiceStatus.Active,
  })
  status: ServiceStatus;

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
    foreignKeyConstraintName: 'fk_services_tenant',
  })
  tenant?: TenantOrmEntity;
}
