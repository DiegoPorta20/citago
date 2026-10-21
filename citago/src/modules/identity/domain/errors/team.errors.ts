import {
  DomainError,
  DomainErrorCategory,
} from '../../../../shared/domain/domain-error.js';
import type { MembershipStatus } from '../membership-status.js';

export class MembershipNotFoundError extends DomainError {
  readonly code = 'MEMBERSHIP_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('User not found in this business.');
  }
}

export class LastOwnerError extends DomainError {
  readonly code = 'LAST_OWNER';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super(
      'A business must keep at least one active OWNER. Promote someone else first.',
    );
  }
}

export class CannotChangeOwnAccessError extends DomainError {
  readonly code = 'CANNOT_CHANGE_OWN_ACCESS';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('You cannot change your own role or revoke your own access.');
  }
}

export class RoleChangeNotAllowedError extends DomainError {
  readonly code = 'ROLE_CHANGE_NOT_ALLOWED';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('Only an OWNER can grant or withdraw ADMIN and OWNER access.');
  }
}

export class UserAlreadyInTeamError extends DomainError {
  readonly code = 'USER_ALREADY_IN_TEAM';
  readonly category = DomainErrorCategory.Conflict;

  constructor(membershipId: string, status: MembershipStatus) {
    super('That person already has access to this business.', {
      membershipId,
      status,
    });
  }
}
