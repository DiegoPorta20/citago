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
@Index('uq_messages_external_id', ['externalMessageId'], { unique: true })
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
