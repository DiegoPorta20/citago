import { Injectable } from '@nestjs/common';

import { Clock } from '../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../shared/application/ports/id-generator.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import { PhoneNumber } from '../../../shared/domain/phone-number.js';
import { ClientRepository } from '../../clients/domain/client.repository.js';
import { Conversation } from '../domain/conversation.entity.js';
import {
  ConversationChannel,
  MessageDirection,
  type MessageType,
} from '../domain/conversation.enums.js';
import {
  ConversationRepository,
  MessageRepository,
} from '../domain/conversation.repositories.js';
import { Message } from '../domain/message.entity.js';

export interface InboundMessageInput {
  /**
   * The tenant this message belongs to, **resolved by the channel adapter**
   * from a verified source (for WhatsApp: the receiving phone number, after
   * checking the webhook signature). There is no user session on this path —
   * it is one of the documented exceptions to "the tenant comes from the JWT".
   */
  readonly tenantId: string;
  readonly channel: ConversationChannel;
  /** Already normalized by the adapter: E.164 for WhatsApp. */
  readonly contactIdentifier: string;
  readonly contactName?: string | null;
  readonly externalMessageId: string;
  readonly type: MessageType;
  readonly body?: string | null;
  readonly mediaReference?: string | null;
  readonly mediaMimeType?: string | null;
  readonly sentAt: Date;
}

export type InboundResult =
  | {
      readonly outcome: 'recorded';
      readonly conversationId: string;
      readonly messageId: string;
    }
  | { readonly outcome: 'duplicate' };

/**
 * Stores a message a client sent through any channel.
 *
 * Channel-agnostic on purpose: the WhatsApp adapter, a future Instagram one and
 * the development simulator all end here, so the rules exist once.
 *
 * - **Idempotent** (rule CO-2): the same `externalMessageId` delivered twice is
 *   stored once. Detection is the unique key, not a lookup, so two copies of a
 *   webhook arriving at the same instant are also safe.
 * - **One thread per contact** (decision F11), created on the first message.
 * - **Links the client** when the number already belongs to one; otherwise the
 *   conversation stays unlinked until someone links it (rule CO-6). An
 *   unknown number never creates a client on its own: spam and wrong numbers
 *   would fill the client list.
 */
@Injectable()
export class RecordInboundMessageUseCase {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly clients: ClientRepository,
    private readonly transaction: TransactionRunner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: InboundMessageInput): Promise<InboundResult> {
    return this.transaction.run(async () => {
      const now = this.clock.now();
      const conversation = await this.threadFor(input, now);

      const message = Message.create({
        id: this.ids.generate(),
        tenantId: input.tenantId,
        conversationId: conversation.id,
        externalMessageId: input.externalMessageId,
        direction: MessageDirection.Inbound,
        type: input.type,
        body: input.body ?? null,
        mediaReference: input.mediaReference ?? null,
        mediaMimeType: input.mediaMimeType ?? null,
        sentAt: input.sentAt,
        receivedAt: now,
        authorUserId: null,
      });

      if (!(await this.messages.insertIfNew(message))) {
        // Already processed: a retry from the channel. Nothing changes.
        return { outcome: 'duplicate' } as const;
      }

      if (conversation.clientId === null) {
        conversation.linkClient(
          await this.findClientId(input.tenantId, input),
          now,
        );
      }

      conversation.updateContactName(input.contactName ?? null, now);
      conversation.registerMessage(message, now);

      await this.conversations.save(conversation);

      return {
        outcome: 'recorded',
        conversationId: conversation.id,
        messageId: message.id,
      } as const;
    });
  }

  /** The existing thread, locked; or a new one. */
  private async threadFor(
    input: InboundMessageInput,
    now: Date,
  ): Promise<Conversation> {
    const lock = { forUpdate: true };
    const existing = await this.conversations.findByContact(
      input.tenantId,
      input.channel,
      input.contactIdentifier,
      lock,
    );

    if (existing) {
      return existing;
    }

    const created = Conversation.start(
      {
        id: this.ids.generate(),
        tenantId: input.tenantId,
        channel: input.channel,
        contactIdentifier: input.contactIdentifier,
        contactName: input.contactName,
        clientId: await this.findClientId(input.tenantId, input),
      },
      now,
    );

    if (await this.conversations.insertIfAbsent(created)) {
      return created;
    }

    // Another message from the same contact created the thread a moment ago.
    const winner = await this.conversations.findByContact(
      input.tenantId,
      input.channel,
      input.contactIdentifier,
      lock,
    );

    if (!winner) {
      throw new Error('Conversation vanished after a concurrent insert.');
    }

    return winner;
  }

  /**
   * On WhatsApp the contact identifier is a phone number, which is how clients
   * are identified too. Deleted clients are not linked: they are gone from the
   * business's point of view until someone restores them.
   */
  private async findClientId(
    tenantId: string,
    input: InboundMessageInput,
  ): Promise<string | null> {
    if (input.channel !== ConversationChannel.WhatsApp) {
      return null;
    }

    const client = await this.clients.findByPhone(
      tenantId,
      PhoneNumber.fromE164(input.contactIdentifier),
    );

    return client && !client.isDeleted ? client.id : null;
  }
}
