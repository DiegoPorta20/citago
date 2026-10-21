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
