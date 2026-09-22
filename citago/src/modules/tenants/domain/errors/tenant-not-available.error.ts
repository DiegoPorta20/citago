import {
  DomainError,
  DomainErrorCategory,
} from '../../../../shared/domain/domain-error.js';

/**
 * The business behind the session is gone or suspended.
 *
 * Raised by any use case that needs the tenant's own configuration — its time
 * zone or its currency — and cannot find it. Reported as not found, like every
 * other resource the caller may not reach.
 */
export class TenantNotAvailableError extends DomainError {
  readonly code = 'TENANT_NOT_AVAILABLE';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('The business of this session is not available.');
  }
}
