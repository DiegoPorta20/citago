import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import type { Page, PageRequest } from '../../../shared/domain/pagination.js';
import { ClientRepository } from '../../clients/domain/client.repository.js';
import type { Conversation } from '../domain/conversation.entity.js';
import { ConversationNotFoundError } from '../domain/conversation.errors.js';
import {
  ConversationRepository,
  MessageRepository,
  type InboxFilters,
  type MessagePage,
} from '../domain/conversation.repositories.js';

export interface ConversationView {
  readonly conversation: Conversation;
  readonly client: { readonly id: string; readonly name: string } | null;
}

/** Attaches client names to a batch of conversations in one query. */
@Injectable()
export class ConversationViewAssembler {
  constructor(private readonly clients: ClientRepository) {}

  async assemble(
    tenantId: string,
    conversations: readonly Conversation[],
  ): Promise<ConversationView[]> {
    const ids = [
      ...new Set(
        conversations
          .map((conversation) => conversation.clientId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const clients = await this.clients.findManyByIdsForTenant(ids, tenantId);
    const byId = new Map(clients.map((client) => [client.id, client]));

    return conversations.map((conversation) => {
      const client = conversation.clientId
        ? byId.get(conversation.clientId)
        : undefined;

      return {
        conversation,
        client: client ? { id: client.id, name: client.name } : null,
      };
    });
  }
}

/** The inbox. Every member of the business sees every conversation. */
@Injectable()
export class ListInboxUseCase {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly assembler: ConversationViewAssembler,
  ) {}

  async execute(
    actor: AuthContext,
    input: PageRequest & InboxFilters,
  ): Promise<Page<ConversationView>> {
    const page = await this.conversations.list(
      actor.tenantId,
      {
        status: input.status,
        needsReply: input.needsReply,
        assignedUserId: input.assignedUserId,
        clientId: input.clientId,
      },
      { page: input.page, limit: input.limit },
    );

    return {
      items: await this.assembler.assemble(actor.tenantId, page.items),
      meta: page.meta,
    };
  }
}

@Injectable()
export class GetConversationUseCase {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly assembler: ConversationViewAssembler,
  ) {}

  async execute(
    actor: AuthContext,
    conversationId: string,
  ): Promise<ConversationView> {
    const conversation = await this.conversations.findByIdForTenant(
      conversationId,
      actor.tenantId,
    );

    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    const [view] = await this.assembler.assemble(actor.tenantId, [
      conversation,
    ]);

    return view;
  }
}

@Injectable()
export class ListMessagesUseCase {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
  ) {}

  async execute(
    actor: AuthContext,
    input: {
      readonly conversationId: string;
      readonly before?: string;
      readonly limit: number;
    },
  ): Promise<MessagePage> {
    // Checked first: messages are only reachable through a conversation of the
    // caller's tenant, so a conversation id from elsewhere reveals nothing.
    const conversation = await this.conversations.findByIdForTenant(
      input.conversationId,
      actor.tenantId,
    );

    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    return this.messages.listForConversation(actor.tenantId, conversation.id, {
      before: input.before,
      limit: input.limit,
    });
  }
}
