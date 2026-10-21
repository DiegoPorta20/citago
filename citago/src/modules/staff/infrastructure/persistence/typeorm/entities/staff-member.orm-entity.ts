import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { MembershipOrmEntity } from '../../../../../identity/infrastructure/persistence/typeorm/entities/membership.orm-entity.js';
import { TenantOrmEntity } from '../../../../../tenants/infrastructure/persistence/typeorm/entities/tenant.orm-entity.js';
import { StaffMemberStatus } from '../../../../domain/staff-member-status.js';

@Entity('staff_members')
@Unique('uq_staff_members_tenant_id', ['tenantId', 'id'])
@Unique('uq_staff_members_tenant_user', ['tenantId', 'userId'])
export class StaffMemberOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'user_id', type: 'char', length: 36, nullable: true })
  userId: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: StaffMemberStatus,
    default: StaffMemberStatus.Active,
  })
  status: StaffMemberStatus;

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
    foreignKeyConstraintName: 'fk_staff_members_tenant',
  })
  tenant?: TenantOrmEntity;

  @ManyToOne(() => MembershipOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_staff_members_membership',
    },
    { name: 'user_id', referencedColumnName: 'userId' },
  ])
  membership?: MembershipOrmEntity;
}
