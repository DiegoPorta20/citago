import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { ClientOrmEntity } from '../../../../../clients/infrastructure/persistence/typeorm/entities/client.orm-entity.js';
import { MembershipOrmEntity } from '../../../../../identity/infrastructure/persistence/typeorm/entities/membership.orm-entity.js';
import { TenantOrmEntity } from '../../../../../tenants/infrastructure/persistence/typeorm/entities/tenant.orm-entity.js';
import {
  ConversationChannel,
  ConversationStatus,
} from '../../../../domain/conversation.enums.js';

@Entity('conversations')
@Unique('uq_conversations_tenant_id', ['tenantId', 'id'])
/** One thread per contact and channel (decision F11); also settles concurrent first messages. */
@Unique('uq_conversations_contact', [
  'tenantId',
  'channel',
  'contactIdentifier',
])
/** The "pending" counter and filtered inbox. */
@Index('ix_conversations_needs_reply', [
  'tenantId',
  'needsReply',
  'lastMessageAt',
])
/** The default inbox, most recent first. */
@Index('ix_conversations_status', ['tenantId', 'status', 'lastMessageAt'])
/** A client's conversation, from the client screen. */
@Index('ix_conversations_client', ['tenantId', 'clientId'])
export class ConversationOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'channel', type: 'enum', enum: ConversationChannel })
  channel: ConversationChannel;

  @Column({ name: 'contact_identifier', type: 'varchar', length: 64 })
  contactIdentifier: string;

  @Column({
    name: 'contact_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  contactName: string | null;

  @Column({ name: 'client_id', type: 'char', length: 36, nullable: true })
  clientId: string | null;

  @Column({
    name: 'assigned_user_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  assignedUserId: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.Open,
  })
  status: ConversationStatus;

  @Column({ name: 'needs_reply', type: 'boolean', default: false })
  needsReply: boolean;

  @Column({
    name: 'last_message_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastMessageAt: Date | null;

  @Column({
    name: 'last_inbound_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastInboundAt: Date | null;

  @Column({
    name: 'last_outbound_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastOutboundAt: Date | null;

  @Column({
    name: 'last_message_preview',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  lastMessagePreview: string | null;

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
    foreignKeyConstraintName: 'fk_conversations_tenant',
  })
  tenant?: TenantOrmEntity;

  /** Composite: a conversation can only point at a client of its own tenant. */
  @ManyToOne(() => ClientOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_conversations_client',
    },
    { name: 'client_id', referencedColumnName: 'id' },
  ])
  client?: ClientOrmEntity;

  /** Composite into memberships: only a member of this business can be the assignee. */
  @ManyToOne(() => MembershipOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_conversations_assignee',
    },
    { name: 'assigned_user_id', referencedColumnName: 'userId' },
  ])
  assignee?: MembershipOrmEntity;
}
