import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { StaffMemberOrmEntity } from './staff-member.orm-entity.js';

@Entity('staff_time_off')
@Index('ix_staff_time_off_staff_start', [
  'tenantId',
  'staffMemberId',
  'startsAt',
])
export class StaffTimeOffOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'staff_member_id', type: 'char', length: 36 })
  staffMemberId: string;

  @Column({ name: 'starts_at', type: 'datetime', precision: 3 })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'datetime', precision: 3 })
  endsAt: Date;

  @Column({ name: 'reason', type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @ManyToOne(() => StaffMemberOrmEntity, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_staff_time_off_staff_member',
    },
    { name: 'staff_member_id', referencedColumnName: 'id' },
  ])
  staffMember?: StaffMemberOrmEntity;
}
