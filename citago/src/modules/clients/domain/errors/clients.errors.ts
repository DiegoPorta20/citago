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

/** Also raised for a client of another tenant: same 404, no existence leak. */
export class ClientNotFoundError extends DomainError {
  readonly code = 'CLIENT_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('Client not found.');
  }
}

/**
 * The phone already belongs to a client of this business.
 *
 * Carries the existing id so the app can open that client instead of making
 * the person figure out what happened. Safe: both belong to the same tenant.
 */
export class ClientPhoneAlreadyRegisteredError extends DomainError {
  readonly code = 'CLIENT_PHONE_ALREADY_REGISTERED';
  readonly category = DomainErrorCategory.Conflict;

  constructor(clientId: string) {
    super('A client with that phone number already exists.', { clientId });
  }
}

/**
 * The phone belongs to a client that was deleted.
 *
 * A soft-deleted client keeps its phone, so re-registering it must not silently
 * create a second record and split the person's history. The app offers to
 * restore the original (decision F4).
 */
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
