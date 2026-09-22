import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { AppointmentOrmEntity } from '../../../../../appointments/infrastructure/persistence/typeorm/entities/appointment.orm-entity.js';
import { ClientOrmEntity } from '../../../../../clients/infrastructure/persistence/typeorm/entities/client.orm-entity.js';
import { UserOrmEntity } from '../../../../../identity/infrastructure/persistence/typeorm/entities/user.orm-entity.js';
import { StaffMemberOrmEntity } from '../../../../../staff/infrastructure/persistence/typeorm/entities/staff-member.orm-entity.js';
import { PaymentMethod } from '../../../../domain/payment-method.js';
import { SaleStatus } from '../../../../domain/sale-status.js';

@Entity('sales')
/** Target of the composite key from the sale lines. */
@Unique('uq_sales_tenant_id', ['tenantId', 'id'])
/**
 * Rule SA-3: an appointment is charged at most once. MySQL does not compare
 * NULLs in a unique index, so counter sales — which have no appointment — are
 * unaffected by it.
 */
@Unique('uq_sales_appointment', ['tenantId', 'appointmentId'])
/** Revenue of a day or a month, the most common query here. */
@Index('ix_sales_sold_at', ['tenantId', 'soldAt'])
/** What one barber took. */
@Index('ix_sales_staff_sold_at', ['tenantId', 'staffMemberId', 'soldAt'])
/** What one client has spent. */
@Index('ix_sales_client_sold_at', ['tenantId', 'clientId', 'soldAt'])
export class SaleOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'appointment_id', type: 'char', length: 36, nullable: true })
  appointmentId: string | null;

  @Column({ name: 'client_id', type: 'char', length: 36, nullable: true })
  clientId: string | null;

  @Column({ name: 'staff_member_id', type: 'char', length: 36, nullable: true })
  staffMemberId: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: SaleStatus,
    default: SaleStatus.Pending,
  })
  status: SaleStatus;

  /** Snapshot of the tenant currency when the sale was recorded (rule SA-6). */
  @Column({ name: 'currency', type: 'char', length: 3 })
  currency: string;

  /** Strings, not numbers: DECIMAL money never goes through floating point. */
  @Column({ name: 'subtotal', type: 'decimal', precision: 12, scale: 2 })
  subtotal: string;

  @Column({ name: 'discount', type: 'decimal', precision: 12, scale: 2 })
  discount: string;

  @Column({ name: 'total', type: 'decimal', precision: 12, scale: 2 })
  total: string;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'sold_at', type: 'datetime', precision: 3 })
  soldAt: Date;

  @Column({ name: 'paid_at', type: 'datetime', precision: 3, nullable: true })
  paidAt: Date | null;

  @Column({ name: 'voided_at', type: 'datetime', precision: 3, nullable: true })
  voidedAt: Date | null;

  @Column({
    name: 'void_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  voidReason: string | null;

  @Column({
    name: 'voided_by_user_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  voidedByUserId: string | null;

  @Column({
    name: 'created_by_user_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  createdByUserId: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  // ── Composite tenant keys (ADR 0004, layer 4) ─────────────────────────────
  // A sale cannot point at another tenant's appointment, client or barber.
  // All RESTRICT: takings are history and are never cascaded away.

  @ManyToOne(() => AppointmentOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_sales_appointment',
    },
    { name: 'appointment_id', referencedColumnName: 'id' },
  ])
  appointment?: AppointmentOrmEntity;

  @ManyToOne(() => ClientOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_sales_client',
    },
    { name: 'client_id', referencedColumnName: 'id' },
  ])
  client?: ClientOrmEntity;

  @ManyToOne(() => StaffMemberOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_sales_staff_member',
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
    foreignKeyConstraintName: 'fk_sales_created_by',
  })
  createdBy?: UserOrmEntity;

  @ManyToOne(() => UserOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'voided_by_user_id',
    foreignKeyConstraintName: 'fk_sales_voided_by',
  })
  voidedBy?: UserOrmEntity;
}
