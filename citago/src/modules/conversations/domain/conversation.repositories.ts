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

export interface LockOptions {
  readonly forUpdate?: boolean;
}

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

  abstract list(
    tenantId: string,
    filters: InboxFilters,
    page: PageRequest,
  ): Promise<Page<Conversation>>;

  abstract insertIfAbsent(conversation: Conversation): Promise<boolean>;

  abstract save(conversation: Conversation): Promise<void>;
}

export interface MessagePage {
  readonly items: readonly Message[];
  readonly hasMore: boolean;
}

export abstract class MessageRepository {
  abstract insertIfNew(message: Message): Promise<boolean>;

  abstract listForConversation(
    tenantId: string,
    conversationId: string,
    options: { readonly before?: string; readonly limit: number },
  ): Promise<MessagePage>;
}
