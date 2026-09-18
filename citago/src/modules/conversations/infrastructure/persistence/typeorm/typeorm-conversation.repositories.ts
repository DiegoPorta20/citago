import { Injectable } from '@nestjs/common';
import { QueryFailedError, type FindOptionsWhere } from 'typeorm';

import {
  buildPage,
  offsetOf,
  type Page,
  type PageRequest,
} from '../../../../../shared/domain/pagination.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { Conversation } from '../../../domain/conversation.entity.js';
import type { ConversationChannel } from '../../../domain/conversation.enums.js';
import {
  ConversationRepository,
  MessageRepository,
  type InboxFilters,
  type LockOptions,
  type MessagePage,
} from '../../../domain/conversation.repositories.js';
import { Message } from '../../../domain/message.entity.js';
import { ConversationOrmEntity } from './entities/conversation.orm-entity.js';
import { MessageOrmEntity } from './entities/message.orm-entity.js';

/** MySQL reports a unique-key violation with this code and the key name. */
function isDuplicateOn(error: unknown, keyName: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: string; message?: string };

  return (
    driverError.code === 'ER_DUP_ENTRY' &&
    (driverError.message ?? '').includes(keyName)
  );
}

@Injectable()
export class TypeOrmConversationRepository extends ConversationRepository {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get repository() {
    return this.context.manager.getRepository(ConversationOrmEntity);
  }

  findByIdForTenant(
    id: string,
    tenantId: string,
    options: LockOptions = {},
  ): Promise<Conversation | null> {
    return this.findOne({ id, tenantId }, options);
  }

  findByContact(
    tenantId: string,
    channel: ConversationChannel,
    contactIdentifier: string,
    options: LockOptions = {},
  ): Promise<Conversation | null> {
    return this.findOne({ tenantId, channel, contactIdentifier }, options);
  }

  async list(
    tenantId: string,
    filters: InboxFilters,
    page: PageRequest,
  ): Promise<Page<Conversation>> {
    const where: FindOptionsWhere<ConversationOrmEntity> = { tenantId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.needsReply !== undefined) {
      where.needsReply = filters.needsReply;
    }
    if (filters.assignedUserId) {
      where.assignedUserId = filters.assignedUserId;
    }
    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    const [rows, total] = await this.repository.findAndCount({
      where,
      order: { lastMessageAt: 'DESC', id: 'DESC' },
      skip: offsetOf(page),
      take: page.limit,
    });

    return buildPage(
      rows.map((row) => this.toDomain(row)),
      total,
      page,
    );
  }

  async insertIfAbsent(conversation: Conversation): Promise<boolean> {
    try {
      await this.repository.insert(this.toRow(conversation));

      return true;
    } catch (error) {
      if (isDuplicateOn(error, 'uq_conversations_contact')) {
        return false;
      }

      throw error;
    }
  }

  async save(conversation: Conversation): Promise<void> {
    await this.repository.save(this.toRow(conversation));
  }

  private async findOne(
    where: FindOptionsWhere<ConversationOrmEntity>,
    options: LockOptions,
  ): Promise<Conversation | null> {
    if (options.forUpdate && !this.context.isInTransaction) {
      throw new Error('A locked read must run inside a transaction.');
    }

    const row = await this.repository.findOne({
      where,
      ...(options.forUpdate ? { lock: { mode: 'pessimistic_write' } } : {}),
    });

    return row ? this.toDomain(row) : null;
  }

  private toRow(conversation: Conversation): ConversationOrmEntity {
    const snapshot = conversation.toSnapshot();
    const row = new ConversationOrmEntity();

    Object.assign(row, snapshot);

    return row;
  }

  private toDomain(row: ConversationOrmEntity): Conversation {
    return Conversation.restore({
      id: row.id,
      tenantId: row.tenantId,
      channel: row.channel,
      contactIdentifier: row.contactIdentifier,
      contactName: row.contactName,
      clientId: row.clientId,
      assignedUserId: row.assignedUserId,
      status: row.status,
      needsReply: Boolean(row.needsReply),
      lastMessageAt: row.lastMessageAt,
      lastInboundAt: row.lastInboundAt,
      lastOutboundAt: row.lastOutboundAt,
      lastMessagePreview: row.lastMessagePreview,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

@Injectable()
export class TypeOrmMessageRepository extends MessageRepository {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get repository() {
    return this.context.manager.getRepository(MessageOrmEntity);
  }

  async insertIfNew(message: Message): Promise<boolean> {
    try {
      await this.repository.insert({ ...message.toSnapshot() });

      return true;
    } catch (error) {
      // A retried webhook: the channel id is already stored. In MySQL a failed
      // statement does not abort the surrounding transaction, so the caller
      // simply reports a duplicate.
      if (isDuplicateOn(error, 'uq_messages_external_id')) {
        return false;
      }

      throw error;
    }
  }

  async listForConversation(
    tenantId: string,
    conversationId: string,
    options: { readonly before?: string; readonly limit: number },
  ): Promise<MessagePage> {
    const query = this.repository
      .createQueryBuilder('message')
      .where('message.tenant_id = :tenantId', { tenantId })
      .andWhere('message.conversation_id = :conversationId', {
        conversationId,
      });

    if (options.before) {
      const cursor = await this.repository.findOneBy({
        id: options.before,
        tenantId,
        conversationId,
      });

      // An unknown cursor (or one from another conversation) yields nothing,
      // rather than silently restarting from the newest message.
      if (!cursor) {
        return { items: [], hasMore: false };
      }

      query.andWhere(
        '(message.sent_at < :cursorSentAt OR (message.sent_at = :cursorSentAt AND message.id < :cursorId))',
        { cursorSentAt: cursor.sentAt, cursorId: cursor.id },
      );
    }

    // One extra row tells whether there is another page, without a COUNT.
    const rows = await query
      .orderBy('message.sent_at', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(options.limit + 1)
      .getMany();

    return {
      items: rows.slice(0, options.limit).map((row) =>
        Message.restore({
          id: row.id,
          tenantId: row.tenantId,
          conversationId: row.conversationId,
          externalMessageId: row.externalMessageId,
          direction: row.direction,
          type: row.type,
          body: row.body,
          mediaReference: row.mediaReference,
          mediaMimeType: row.mediaMimeType,
          sentAt: row.sentAt,
          receivedAt: row.receivedAt,
          authorUserId: row.authorUserId,
        }),
      ),
      hasMore: rows.length > options.limit,
    };
  }
}
