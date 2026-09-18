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

@Entity('clients')
/** Target of the composite foreign keys appointments and sales will use (ADR 0004). */
@Unique('uq_clients_tenant_id', ['tenantId', 'id'])
/**
 * One client per phone per business (rule CL-2). MySQL allows several NULLs in
 * a unique index, so walk-ins registered without a number do not collide.
 */
@Unique('uq_clients_tenant_phone', ['tenantId', 'phoneE164'])
@Index('ix_clients_tenant_name', ['tenantId', 'name'])
export class ClientOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'phone_e164', type: 'varchar', length: 20, nullable: true })
  phoneE164: string | null;

  @Column({ name: 'email', type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  /** Soft delete: the row outlives the UI "delete" so history keeps its customer. */
  @Column({
    name: 'deleted_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  deletedAt: Date | null;

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
    foreignKeyConstraintName: 'fk_clients_tenant',
  })
  tenant?: TenantOrmEntity;
}
