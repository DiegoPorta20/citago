import type { Page, PageRequest } from '../../../shared/domain/pagination.js';
import type { Conversation } from './conversation.entity.js';
import type {
  ConversationChannel,
  ConversationStatus,
} from './conversation.enums.js';
import type { Message } from './message.entity.js';

export interface InboxFilters {
  readonly status?: ConversationStatus;
  readonly needsReply?: boolean;
  readonly assignedUserId?: string;
  readonly clientId?: string;
}

/**
 * `forUpdate` locks the row until the transaction ends. Every write path uses
 * it: two messages from the same contact arriving together, or an archive
 * racing a new message, would otherwise overwrite each other's changes and
 * leave the pending counter wrong.
 */
export interface LockOptions {
  readonly forUpdate?: boolean;
}

/**
 * Persistence contract for conversations. **Every method takes `tenantId`.**
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class ConversationRepository {
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
    options?: LockOptions,
  ): Promise<Conversation | null>;

  abstract findByContact(
    tenantId: string,
    channel: ConversationChannel,
    contactIdentifier: string,
    options?: LockOptions,
  ): Promise<Conversation | null>;

  /** The inbox, most recent activity first. */
  abstract list(
    tenantId: string,
    filters: InboxFilters,
    page: PageRequest,
  ): Promise<Page<Conversation>>;

  /**
   * Inserts a new thread. Returns `false` when another request created the
   * thread for the same contact first (two first messages arriving at once):
   * the unique key decides, and the caller loads the winner.
   */
  abstract insertIfAbsent(conversation: Conversation): Promise<boolean>;

  abstract save(conversation: Conversation): Promise<void>;
}

export interface MessagePage {
  readonly items: readonly Message[];
  /** More, older messages exist before the last item returned. */
  readonly hasMore: boolean;
}

/**
 * Persistence contract for messages. Append-only: there is no update and no
 * delete (rule CO-3).
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class MessageRepository {
  /**
   * Stores a message unless its `externalMessageId` was already stored.
   *
   * Returns `false` for a duplicate delivery. Detection relies on the unique
   * key, not on a lookup first, so two copies of the same webhook arriving at
   * the same instant cannot both get through (rule CO-2).
   */
  abstract insertIfNew(message: Message): Promise<boolean>;

  /**
   * Messages of a conversation, newest first, keyset-paginated: `before` is a
   * message id, and the page contains the messages sent before it.
   *
   * Keyset rather than page numbers because a chat grows at the top while
   * someone scrolls: offsets would repeat or skip messages.
   */
  abstract listForConversation(
    tenantId: string,
    conversationId: string,
    options: { readonly before?: string; readonly limit: number },
  ): Promise<MessagePage>;
}
