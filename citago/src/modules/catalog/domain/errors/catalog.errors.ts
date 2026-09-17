import {
  DomainError,
  DomainErrorCategory,
} from '../../../../shared/domain/domain-error.js';

export class InvalidServiceDataError extends DomainError {
  readonly code = 'INVALID_SERVICE_DATA';
  readonly category = DomainErrorCategory.Validation;

  constructor(field: string, reason: string) {
    super(`Invalid service ${field}: ${reason}`, { field });
  }
}

/**
 * Raised for a service of another tenant too.
 *
 * Reporting "forbidden" instead would confirm that the id exists, which is the
 * information an IDOR probe is looking for.
 */
export class ServiceNotFoundError extends DomainError {
  readonly code = 'SERVICE_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('Service not found.');
  }
}

export class DuplicateServiceNameError extends DomainError {
  readonly code = 'DUPLICATE_SERVICE_NAME';
  readonly category = DomainErrorCategory.Conflict;

  constructor(name: string) {
    super('Another active service already uses that name.', { name });
  }
}
