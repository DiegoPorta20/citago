import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';

export class InvalidStaffDataError extends DomainError {
  readonly code = 'INVALID_STAFF_DATA';
  readonly category = DomainErrorCategory.Validation;

  constructor(field: string, reason: string) {
    super(`Invalid staff ${field}: ${reason}`, { field });
  }
}

export class InvalidScheduleError extends DomainError {
  readonly code = 'INVALID_SCHEDULE';
  readonly category = DomainErrorCategory.Validation;

  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Invalid weekly schedule: ${reason}`, details);
  }
}

/** Also raised for another tenant's staff member: same 404, no existence leak. */
export class StaffMemberNotFoundError extends DomainError {
  readonly code = 'STAFF_MEMBER_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('Staff member not found.');
  }
}

/** The account must belong to this business before it can be linked. */
export class UserNotMemberOfTenantError extends DomainError {
  readonly code = 'USER_NOT_MEMBER_OF_TENANT';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('That user does not belong to this business.');
  }
}

export class UserAlreadyLinkedToStaffError extends DomainError {
  readonly code = 'USER_ALREADY_LINKED_TO_STAFF';
  readonly category = DomainErrorCategory.Conflict;

  constructor() {
    super('That user is already linked to another staff member.');
  }
}

export class TimeOffNotFoundError extends DomainError {
  readonly code = 'TIME_OFF_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('Time off not found.');
  }
}

export class InvalidTimeOffError extends DomainError {
  readonly code = 'INVALID_TIME_OFF';
  readonly category = DomainErrorCategory.Validation;

  constructor(reason: string) {
    super(`Invalid time off: ${reason}`);
  }
}
