import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { ServiceOrmEntity } from '../../../../../catalog/infrastructure/persistence/typeorm/entities/service.orm-entity.js';
import { ClientOrmEntity } from '../../../../../clients/infrastructure/persistence/typeorm/entities/client.orm-entity.js';
import { UserOrmEntity } from '../../../../../identity/infrastructure/persistence/typeorm/entities/user.orm-entity.js';
import { StaffMemberOrmEntity } from '../../../../../staff/infrastructure/persistence/typeorm/entities/staff-member.orm-entity.js';
import { AppointmentSource } from '../../../../domain/appointment-source.js';
import { AppointmentStatus } from '../../../../domain/appointment-status.js';

@Entity('appointments')
/** Target of the composite keys from the status history and, later, sales. */
@Unique('uq_appointments_tenant_id', ['tenantId', 'id'])
/** Overlap detection and per-barber agenda. The most important index here. */
@Index('ix_appointments_staff_start', ['tenantId', 'staffMemberId', 'startAt'])
/** Day and week views across all staff. */
@Index('ix_appointments_start', ['tenantId', 'startAt'])
/** A client's history. */
@Index('ix_appointments_client_start', ['tenantId', 'clientId', 'startAt'])
export class AppointmentOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'client_id', type: 'char', length: 36 })
  clientId: string;

  @Column({ name: 'service_id', type: 'char', length: 36 })
  serviceId: string;

  @Column({ name: 'staff_member_id', type: 'char', length: 36 })
  staffMemberId: string;

  @Column({ name: 'start_at', type: 'datetime', precision: 3 })
  startAt: Date;

  @Column({ name: 'end_at', type: 'datetime', precision: 3 })
  endAt: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.Pending,
  })
  status: AppointmentStatus;

  /** Snapshot of the service price at booking (rule AP-2). String: DECIMAL, never float. */
  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2 })
  price: string;

  @Column({ name: 'notes', type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({
    name: 'source',
    type: 'enum',
    enum: AppointmentSource,
    default: AppointmentSource.Manual,
  })
  source: AppointmentSource;

  @Column({
    name: 'created_by_user_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  createdByUserId: string | null;

  @Column({
    name: 'completed_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  completedAt: Date | null;

  @Column({
    name: 'cancelled_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  cancelledAt: Date | null;

  @Column({
    name: 'cancellation_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  cancellationReason: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  // ── Composite tenant keys (ADR 0004, layer 4) ─────────────────────────────
  // Each reference carries tenant_id, so the database refuses an appointment
  // that points at another tenant's client, service or barber — even if the
  // application had a bug. All RESTRICT: history is never cascaded away.

  @ManyToOne(() => ClientOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_appointments_client',
    },
    { name: 'client_id', referencedColumnName: 'id' },
  ])
  client?: ClientOrmEntity;

  @ManyToOne(() => ServiceOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_appointments_service',
    },
    { name: 'service_id', referencedColumnName: 'id' },
  ])
  service?: ServiceOrmEntity;

  @ManyToOne(() => StaffMemberOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_appointments_staff_member',
    },
    { name: 'staff_member_id', referencedColumnName: 'id' },
  ])
  staffMember?: StaffMemberOrmEntity;

  @ManyToOne(() => UserOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'created_by_user_id',
    foreignKeyConstraintName: 'fk_appointments_created_by',
  })
  createdBy?: UserOrmEntity;
}
