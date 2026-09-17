import {
  DomainError,
  DomainErrorCategory,
} from '../../../../shared/domain/domain-error.js';

/**
 * Deliberately says nothing about *why*.
 *
 * Unknown email, wrong password and malformed hash all produce this same
 * error, so the API cannot be used to discover which emails have an account.
 */
export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';
  readonly category = DomainErrorCategory.Unauthorized;

  constructor() {
    super('Invalid email or password.');
  }
}

export class EmailAlreadyRegisteredError extends DomainError {
  readonly code = 'EMAIL_ALREADY_REGISTERED';
  readonly category = DomainErrorCategory.Conflict;

  constructor() {
    super('That email address is already registered.');
  }
}

/** The account exists, but no business grants it access. */
export class NoActiveMembershipError extends DomainError {
  readonly code = 'NO_ACTIVE_MEMBERSHIP';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('This account does not have access to any active business.');
  }
}

export class TenantSuspendedError extends DomainError {
  readonly code = 'TENANT_SUSPENDED';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('This business is suspended.');
  }
}

export class MembershipRevokedError extends DomainError {
  readonly code = 'MEMBERSHIP_REVOKED';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('Your access to this business has been revoked.');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  readonly code = 'INVALID_REFRESH_TOKEN';
  readonly category = DomainErrorCategory.Unauthorized;

  constructor() {
    super('The session could not be refreshed. Sign in again.');
  }
}

export class InsufficientRoleError extends DomainError {
  readonly code = 'INSUFFICIENT_ROLE';
  readonly category = DomainErrorCategory.Forbidden;

  constructor(required: readonly string[]) {
    super('Your role does not allow this operation.', { required });
  }
}
