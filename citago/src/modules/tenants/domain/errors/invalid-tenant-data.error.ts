import {
  DomainError,
  DomainErrorCategory,
} from '../../../../shared/domain/domain-error.js';

export class InvalidTenantDataError extends DomainError {
  readonly code = 'INVALID_TENANT_DATA';
  readonly category = DomainErrorCategory.Validation;

  constructor(field: string, reason: string) {
    super(`Invalid tenant ${field}: ${reason}`, { field });
  }
}
