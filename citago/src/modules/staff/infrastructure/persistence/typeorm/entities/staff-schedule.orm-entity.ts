import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { StaffMemberOrmEntity } from './staff-member.orm-entity.js';

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
