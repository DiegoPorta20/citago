import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';

/** Also raised for another tenant's conversation: same 404, no existence leak. */
export class ConversationNotFoundError extends DomainError {
  readonly code = 'CONVERSATION_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('Conversation not found.');
  }
}

export class InvalidMessageError extends DomainError {
  readonly code = 'INVALID_MESSAGE';
  readonly category = DomainErrorCategory.Validation;

  constructor(reason: string) {
    super(`Invalid message: ${reason}`);
  }
}

export class InvalidConversationDataError extends DomainError {
  readonly code = 'INVALID_CONVERSATION_DATA';
  readonly category = DomainErrorCategory.Validation;

  constructor(field: string, reason: string) {
    super(`Invalid conversation ${field}: ${reason}`, { field });
  }
}

/** Only an active member of this business can be put in charge of a conversation. */
export class AssigneeNotMemberError extends DomainError {
  readonly code = 'ASSIGNEE_NOT_MEMBER';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('That user is not an active member of this business.');
  }
}

/** The inbound simulator is a development tool and is off in production. */
export class DevToolsDisabledError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('Not found.');
  }
}

/** The business has not connected the channel this conversation happens on. */
export class ChannelNotConnectedError extends DomainError {
  readonly code = 'CHANNEL_NOT_CONNECTED';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('The channel of this conversation is not connected.');
  }
}

/**
 * The channel only allows a free-form reply for a while after the contact's
 * last message (WhatsApp: 24 hours). After that, only pre-approved templates.
 */
export class ReplyWindowClosedError extends DomainError {
  readonly code = 'REPLY_WINDOW_CLOSED';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super(
      'The reply window is closed: the client has not written recently enough.',
    );
  }
}

export type DeliveryFailureReason =
  /** The channel refused our credentials (expired or revoked token). */
  | 'CHANNEL_AUTH'
  /** The channel refused this particular message. */
  | 'REJECTED'
  /** The channel could not be reached or failed on its side. */
  | 'UNAVAILABLE';

/** The message was not sent. Nothing was recorded. */
export class MessageDeliveryFailedError extends DomainError {
  readonly code = 'MESSAGE_DELIVERY_FAILED';
  readonly category = DomainErrorCategory.ExternalService;

  constructor(readonly reason: DeliveryFailureReason) {
    super('The message could not be delivered through the channel.', {
      reason,
    });
  }
}
