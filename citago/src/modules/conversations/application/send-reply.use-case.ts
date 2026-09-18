import { Injectable, Logger } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../shared/application/ports/id-generator.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import type { Conversation } from '../domain/conversation.entity.js';
import { MessageDirection, MessageType } from '../domain/conversation.enums.js';
import {
  ConversationNotFoundError,
  ReplyWindowClosedError,
} from '../domain/conversation.errors.js';
import {
  ConversationRepository,
  MessageRepository,
} from '../domain/conversation.repositories.js';
import { Message } from '../domain/message.entity.js';
import { ChannelMessenger } from './ports/channel-messenger.port.js';

export interface SendReplyInput {
  readonly conversationId: string;
  readonly body: string;
}

/**
 * Answers a client from CitaGo (decision D1).
 *
 * The message is sent **before** it is recorded, and the network call happens
 * **outside** the database transaction: holding a row lock while waiting on
 * Meta would stall every inbound message of that conversation. Consequences:
 *
 * - if sending fails, nothing is recorded and the caller gets the error;
 * - if sending succeeds but recording fails (the database went away in
 *   between), the client has the message and the inbox does not. That is
 *   logged; it is the lesser evil compared to recording a message that was
 *   never delivered.
 */
@Injectable()
export class SendReplyUseCase {
  private readonly logger = new Logger(SendReplyUseCase.name);

  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly messenger: ChannelMessenger,
    private readonly transaction: TransactionRunner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(actor: AuthContext, input: SendReplyInput): Promise<Message> {
    const conversation = await this.conversations.findByIdForTenant(
      input.conversationId,
      actor.tenantId,
    );

    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    // Validates the text before anything leaves the building.
    const draft = this.buildMessage(actor, conversation, input.body, null);

    if (
      !conversation.canReplyFreely(
        this.clock.now(),
        this.messenger.replyWindowMs(conversation.channel),
      )
    ) {
      throw new ReplyWindowClosedError();
    }

    const sent = await this.messenger.sendText({
      tenantId: actor.tenantId,
      channel: conversation.channel,
      recipient: conversation.contactIdentifier,
      body: draft.body ?? '',
    });

    try {
      return await this.record(actor, input, sent.externalMessageId);
    } catch (error) {
      this.logger.error(
        `Reply ${sent.externalMessageId} was delivered but could not be recorded in conversation ${conversation.id}.`,
      );
      throw error;
    }
  }

  private record(
    actor: AuthContext,
    input: SendReplyInput,
    externalMessageId: string,
  ): Promise<Message> {
    return this.transaction.run(async () => {
      const conversation = await this.conversations.findByIdForTenant(
        input.conversationId,
        actor.tenantId,
        { forUpdate: true },
      );

      if (!conversation) {
        throw new ConversationNotFoundError();
      }

      const message = this.buildMessage(
        actor,
        conversation,
        input.body,
        externalMessageId,
      );

      await this.messages.insertIfNew(message);
      conversation.registerMessage(message, this.clock.now());
      await this.conversations.save(conversation);

      return message;
    });
  }

  private buildMessage(
    actor: AuthContext,
    conversation: Conversation,
    body: string,
    externalMessageId: string | null,
  ): Message {
    const now = this.clock.now();

    return Message.create({
      id: this.ids.generate(),
      tenantId: actor.tenantId,
      conversationId: conversation.id,
      externalMessageId,
      direction: MessageDirection.Outbound,
      type: MessageType.Text,
      body,
      mediaReference: null,
      mediaMimeType: null,
      sentAt: now,
      receivedAt: now,
      authorUserId: actor.userId,
    });
  }
}
