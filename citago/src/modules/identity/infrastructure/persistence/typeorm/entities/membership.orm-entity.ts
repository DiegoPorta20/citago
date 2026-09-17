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
import { MembershipStatus } from '../../../../domain/membership-status.js';
import { UserRole } from '../../../../../../shared/domain/user-role.js';
import { UserOrmEntity } from './user.orm-entity.js';

/**
 * Grants a user access to a tenant, with a role.
 *
 * This is the object the authenticated session is bound to: revoking a
 * membership removes access to one business without touching the account.
 */
@Entity('memberships')
@Unique('uq_memberships_tenant_user', ['tenantId', 'userId'])
export class MembershipOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  /** Indexed on its own: login looks up every membership of a user. */
  @Index('ix_memberships_user')
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ name: 'role', type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({
    name: 'status',
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.Active,
  })
  status: MembershipStatus;

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
    foreignKeyConstraintName: 'fk_memberships_tenant',
  })
  tenant?: TenantOrmEntity;

  @ManyToOne(() => UserOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_memberships_user',
  })
  user?: UserOrmEntity;
}
