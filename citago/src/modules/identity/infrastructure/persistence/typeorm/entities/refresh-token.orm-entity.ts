import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { TenantOrmEntity } from '../../../../../tenants/infrastructure/persistence/typeorm/entities/tenant.orm-entity.js';
import { MembershipOrmEntity } from './membership.orm-entity.js';
import { UserOrmEntity } from './user.orm-entity.js';

/**
 * A refresh token in storage.
 *
 * Only the SHA-256 hash is persisted, so a database dump does not hand out
 * sessions. Tokens rotate on every use: reusing a rotated token means the
 * whole family is revoked (theft detection).
 *
 * This is infrastructure, not domain: it exists because sessions must be
 * revocable, which is not a business concept.
 */
@Entity('refresh_tokens')
export class RefreshTokenOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Index('ix_refresh_tokens_user')
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  /**
   * The tenant this session belongs to.
   *
   * Denormalized from the membership so the refresh flow can look the
   * membership up **with its tenant**, keeping every membership read
   * tenant-scoped (see docs/adr/0004-tenant-isolation.md).
   */
  @Index('ix_refresh_tokens_tenant')
  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  /** The session is bound to one membership, so it is bound to one access grant. */
  @Column({ name: 'membership_id', type: 'char', length: 36 })
  membershipId: string;

  @Index('uq_refresh_tokens_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  /** Rotation chain: revoking a family kills every descendant at once. */
  @Index('ix_refresh_tokens_family')
  @Column({ name: 'family_id', type: 'char', length: 36 })
  familyId: string;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt: Date;

  @Column({
    name: 'revoked_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  revokedAt: Date | null;

  @Column({
    name: 'replaced_by_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  replacedById: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE', onUpdate: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_refresh_tokens_user',
  })
  user?: UserOrmEntity;

  @ManyToOne(() => TenantOrmEntity, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_refresh_tokens_tenant',
  })
  tenant?: TenantOrmEntity;

  @ManyToOne(() => MembershipOrmEntity, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'membership_id',
    foreignKeyConstraintName: 'fk_refresh_tokens_membership',
  })
  membership?: MembershipOrmEntity;
}
