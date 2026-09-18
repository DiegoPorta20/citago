import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import { ClientRepository } from '../../clients/domain/client.repository.js';
import { ClientNotFoundError } from '../../clients/domain/errors/clients.errors.js';
import { MembershipRepository } from '../../identity/domain/membership.repository.js';
import type { Conversation } from '../domain/conversation.entity.js';
import {
  AssigneeNotMemberError,
  ConversationNotFoundError,
} from '../domain/conversation.errors.js';
import { ConversationRepository } from '../domain/conversation.repositories.js';

/**
 * Shared shape of every conversation change: inside a transaction, load the
 * thread **locked**, apply the change, save. The lock is what keeps an archive
 * from overwriting a message that arrived in the same instant.
 */
@Injectable()
export class ConversationChanges {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly transaction: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  apply(
    actor: AuthContext,
    conversationId: string,
    change: (conversation: Conversation, now: Date) => Promise<void> | void,
  ): Promise<Conversation> {
    return this.transaction.run(async () => {
      const conversation = await this.conversations.findByIdForTenant(
        conversationId,
        actor.tenantId,
        { forUpdate: true },
      );

      if (!conversation) {
        throw new ConversationNotFoundError();
      }

      await change(conversation, this.clock.now());
      await this.conversations.save(conversation);

      return conversation;
    });
  }
}

/** "Handled": clears the pending flag even if the answer went by phone. */
@Injectable()
export class MarkConversationResolvedUseCase {
  constructor(private readonly changes: ConversationChanges) {}

  execute(actor: AuthContext, conversationId: string): Promise<Conversation> {
    return this.changes.apply(actor, conversationId, (conversation, now) =>
      conversation.markResolved(now),
    );
  }
}

/** Out of the inbox until the client writes again. */
@Injectable()
export class ArchiveConversationUseCase {
  constructor(private readonly changes: ConversationChanges) {}

  execute(actor: AuthContext, conversationId: string): Promise<Conversation> {
    return this.changes.apply(actor, conversationId, (conversation, now) =>
      conversation.archive(now),
    );
  }
}

@Injectable()
export class ReopenConversationUseCase {
  constructor(private readonly changes: ConversationChanges) {}

  execute(actor: AuthContext, conversationId: string): Promise<Conversation> {
    return this.changes.apply(actor, conversationId, (conversation, now) =>
      conversation.reopen(now),
    );
  }
}

/**
 * Says who this contact is. The client must belong to this business and not be
 * deleted; `null` unlinks a wrong match.
 */
@Injectable()
export class LinkConversationClientUseCase {
  constructor(
    private readonly changes: ConversationChanges,
    private readonly clients: ClientRepository,
  ) {}

  execute(
    actor: AuthContext,
    input: {
      readonly conversationId: string;
      readonly clientId: string | null;
    },
  ): Promise<Conversation> {
    return this.changes.apply(
      actor,
      input.conversationId,
      async (conversation, now) => {
        if (input.clientId !== null) {
          const client = await this.clients.findByIdForTenant(
            input.clientId,
            actor.tenantId,
          );

          if (!client) {
            throw new ClientNotFoundError();
          }
        }

        conversation.linkClient(input.clientId, now);
      },
    );
  }
}

/**
 * Puts a member in charge of a conversation. The assignee must be an **active
 * member of this business**; `null` unassigns.
 */
@Injectable()
export class AssignConversationUseCase {
  constructor(
    private readonly changes: ConversationChanges,
    private readonly memberships: MembershipRepository,
  ) {}

  execute(
    actor: AuthContext,
    input: {
      readonly conversationId: string;
      readonly assigneeUserId: string | null;
    },
  ): Promise<Conversation> {
    return this.changes.apply(
      actor,
      input.conversationId,
      async (conversation, now) => {
        if (input.assigneeUserId !== null) {
          const membership = await this.memberships.findByTenantAndUser(
            actor.tenantId,
            input.assigneeUserId,
          );

          if (!membership?.isActive) {
            throw new AssigneeNotMemberError();
          }
        }

        conversation.assignTo(input.assigneeUserId, now);
      },
    );
  }
}
