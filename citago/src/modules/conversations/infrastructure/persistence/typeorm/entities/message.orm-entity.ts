import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { UserOrmEntity } from '../../../../../identity/infrastructure/persistence/typeorm/entities/user.orm-entity.js';
import {
  MessageDirection,
  MessageType,
} from '../../../../domain/conversation.enums.js';
import { ConversationOrmEntity } from './conversation.orm-entity.js';

@Entity('messages')
/**
 * Idempotency key (rule CO-2). **Global**, not per tenant: the channel's id is
 * already unique worldwide, and duplicate detection must not depend on having
 * resolved the tenant correctly. NULL for messages without a channel id.
 */
@Index('uq_messages_external_id', ['externalMessageId'], { unique: true })
/** Chat history, newest first, with a stable tie-break for keyset pagination. */
@Index('ix_messages_conversation_sent', [
  'tenantId',
  'conversationId',
  'sentAt',
  'id',
])
export class MessageOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'conversation_id', type: 'char', length: 36 })
  conversationId: string;

  @Column({
    name: 'external_message_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  externalMessageId: string | null;

  @Column({ name: 'direction', type: 'enum', enum: MessageDirection })
  direction: MessageDirection;

  @Column({ name: 'type', type: 'enum', enum: MessageType })
  type: MessageType;

  /** TEXT: a WhatsApp message can be up to 4096 characters. */
  @Column({ name: 'body', type: 'text', nullable: true })
  body: string | null;

  @Column({
    name: 'media_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  mediaReference: string | null;

  @Column({
    name: 'media_mime_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  mediaMimeType: string | null;

  @Column({ name: 'sent_at', type: 'datetime', precision: 3 })
  sentAt: Date;

  @Column({ name: 'received_at', type: 'datetime', precision: 3 })
  receivedAt: Date;

  @Column({ name: 'author_user_id', type: 'char', length: 36, nullable: true })
  authorUserId: string | null;

  /** CASCADE: messages are part of the conversation aggregate. */
  @ManyToOne(() => ConversationOrmEntity, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_messages_conversation',
    },
    { name: 'conversation_id', referencedColumnName: 'id' },
  ])
  conversation?: ConversationOrmEntity;

  @ManyToOne(() => UserOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'author_user_id',
    foreignKeyConstraintName: 'fk_messages_author',
  })
  author?: UserOrmEntity;
}
