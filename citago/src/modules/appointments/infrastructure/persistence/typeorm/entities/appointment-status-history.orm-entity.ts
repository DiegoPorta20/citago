import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { AppointmentOrmEntity } from './appointment.orm-entity.js';

/**
 * Who moved an appointment, when, and why (decision F5).
 *
 * Append-only. It answers "who cancelled my appointment?" and feeds the
 * cancellation and no-show metrics without adding a column per status.
 */
@Entity('appointment_status_history')
@Index('ix_appointment_history_appointment', [
  'tenantId',
  'appointmentId',
  'changedAt',
])
export class AppointmentStatusHistoryOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'appointment_id', type: 'char', length: 36 })
  appointmentId: string;

  /** NULL for the creation entry. */
  @Column({ name: 'from_status', type: 'varchar', length: 20, nullable: true })
  fromStatus: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 20 })
  toStatus: string;

  @Column({ name: 'reason', type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({
    name: 'changed_by_user_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  changedByUserId: string | null;

  @Column({ name: 'changed_at', type: 'datetime', precision: 3 })
  changedAt: Date;

  @ManyToOne(() => AppointmentOrmEntity, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_appointment_history_appointment',
    },
    { name: 'appointment_id', referencedColumnName: 'id' },
  ])
  appointment?: AppointmentOrmEntity;
}
