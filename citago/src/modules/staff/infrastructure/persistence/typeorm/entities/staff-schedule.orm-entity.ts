import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { StaffMemberOrmEntity } from './staff-member.orm-entity.js';

/** One working range of one weekday. Local wall-clock time, not UTC (rule TZ-3). */
@Entity('staff_schedules')
@Index('ix_staff_schedules_staff', ['tenantId', 'staffMemberId', 'weekday'])
export class StaffScheduleOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'staff_member_id', type: 'char', length: 36 })
  staffMemberId: string;

  @Column({ name: 'weekday', type: 'tinyint', unsigned: true })
  weekday: number;

  /** Returned by MySQL as `HH:mm:ss`. */
  @Column({ name: 'starts_at', type: 'time' })
  startsAt: string;

  @Column({ name: 'ends_at', type: 'time' })
  endsAt: string;

  @ManyToOne(() => StaffMemberOrmEntity, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_staff_schedules_staff_member',
    },
    { name: 'staff_member_id', referencedColumnName: 'id' },
  ])
  staffMember?: StaffMemberOrmEntity;
}
