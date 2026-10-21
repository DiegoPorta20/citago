import {
  DomainError,
  DomainErrorCategory,
} from '../../../../shared/domain/domain-error.js';

export class TenantNotAvailableError extends DomainError {
  readonly code = 'TENANT_NOT_AVAILABLE';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('The business of this session is not available.');
  }
}
