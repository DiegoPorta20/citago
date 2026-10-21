import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';

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

export class AssigneeNotMemberError extends DomainError {
  readonly code = 'ASSIGNEE_NOT_MEMBER';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('That user is not an active member of this business.');
  }
}

export class DevToolsDisabledError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('Not found.');
  }
}

export class ChannelNotConnectedError extends DomainError {
  readonly code = 'CHANNEL_NOT_CONNECTED';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('The channel of this conversation is not connected.');
  }
}

export class ReplyWindowClosedError extends DomainError {
  readonly code = 'REPLY_WINDOW_CLOSED';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super(
      'The reply window is closed: the client has not written recently enough.',
    );
  }
}

export type DeliveryFailureReason = 'CHANNEL_AUTH' | 'REJECTED' | 'UNAVAILABLE';

export class MessageDeliveryFailedError extends DomainError {
  readonly code = 'MESSAGE_DELIVERY_FAILED';
  readonly category = DomainErrorCategory.ExternalService;

  constructor(readonly reason: DeliveryFailureReason) {
    super('The message could not be delivered through the channel.', {
      reason,
    });
  }
}
