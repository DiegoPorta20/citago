import {
  DomainError,
  DomainErrorCategory,
} from '../../../../shared/domain/domain-error.js';
import type { MembershipStatus } from '../membership-status.js';

/** Also raised for a membership of another tenant: never disclose which. */
export class MembershipNotFoundError extends DomainError {
  readonly code = 'MEMBERSHIP_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('User not found in this business.');
  }
}

/** Rule ID-1: a business without an active OWNER can never be administered again. */
export class LastOwnerError extends DomainError {
  readonly code = 'LAST_OWNER';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super(
      'A business must keep at least one active OWNER. Promote someone else first.',
    );
  }
}

/**
 * Rule ID-7: nobody revokes or demotes themselves.
 *
 * Not paternalism: it is what stops the only administrator of a shop from
 * locking themselves out with one tap, which no other endpoint can undo.
 */
export class CannotChangeOwnAccessError extends DomainError {
  readonly code = 'CANNOT_CHANGE_OWN_ACCESS';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('You cannot change your own role or revoke your own access.');
  }
}

/** An ADMIN manages STAFF only; peers and owners are the OWNER's business. */
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
