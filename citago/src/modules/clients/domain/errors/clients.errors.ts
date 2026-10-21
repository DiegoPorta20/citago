import {
  DomainError,
  DomainErrorCategory,
} from '../../../../shared/domain/domain-error.js';

export class InvalidClientDataError extends DomainError {
  readonly code = 'INVALID_CLIENT_DATA';
  readonly category = DomainErrorCategory.Validation;

  constructor(field: string, reason: string) {
    super(`Invalid client ${field}: ${reason}`, { field });
  }
}

export class ClientNotFoundError extends DomainError {
  readonly code = 'CLIENT_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('Client not found.');
  }
}

export class ClientPhoneAlreadyRegisteredError extends DomainError {
  readonly code = 'CLIENT_PHONE_ALREADY_REGISTERED';
  readonly category = DomainErrorCategory.Conflict;

  constructor(clientId?: string) {
    super(
      'A client with that phone number already exists.',
      clientId ? { clientId } : undefined,
    );
  }
}

export class ClientDeletedWithSamePhoneError extends DomainError {
  readonly code = 'CLIENT_DELETED_WITH_SAME_PHONE';
  readonly category = DomainErrorCategory.Conflict;

  constructor(clientId: string) {
    super(
      'A deleted client already uses that phone number. Restore it to keep its history.',
      { clientId, restorable: true },
    );
  }
}

export class ClientAlreadyDeletedError extends DomainError {
  readonly code = 'CLIENT_ALREADY_DELETED';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('That client is already deleted.');
  }
}
