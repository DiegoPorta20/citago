import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';
import type { AppointmentStatus } from './appointment-status.js';

/** Also raised for another tenant's appointment, or one a STAFF user may not see. */
export class AppointmentNotFoundError extends DomainError {
  readonly code = 'APPOINTMENT_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('Appointment not found.');
  }
}

export class InvalidAppointmentTransitionError extends DomainError {
  readonly code = 'INVALID_APPOINTMENT_TRANSITION';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor(from: AppointmentStatus, to: AppointmentStatus) {
    super(`An appointment cannot go from ${from} to ${to}.`, { from, to });
  }
}

/** The staff member already has an appointment that occupies part of this time (rule AP-3). */
export class AppointmentOverlapError extends DomainError {
  readonly code = 'APPOINTMENT_OVERLAP';
  readonly category = DomainErrorCategory.Conflict;

  constructor(conflictingAppointmentId: string) {
    super('The staff member already has an appointment at that time.', {
      conflictingAppointmentId,
    });
  }
}

export class OutsideStaffScheduleError extends DomainError {
  readonly code = 'OUTSIDE_STAFF_SCHEDULE';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super(
      'The appointment falls outside the staff member working hours. An OWNER or ADMIN can book it anyway.',
    );
  }
}

export class StaffOnTimeOffError extends DomainError {
  readonly code = 'STAFF_ON_TIME_OFF';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super(
      'The staff member is off at that time. An OWNER or ADMIN can book it anyway.',
    );
  }
}

export class AppointmentSpansDaysError extends DomainError {
  readonly code = 'APPOINTMENT_SPANS_DAYS';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('An appointment must start and end on the same local day.');
  }
}

export class AppointmentInThePastError extends DomainError {
  readonly code = 'APPOINTMENT_IN_THE_PAST';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super(
      'Only an OWNER or ADMIN can record an appointment that already started.',
    );
  }
}

export class NotReschedulableError extends DomainError {
  readonly code = 'APPOINTMENT_NOT_RESCHEDULABLE';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor(status: AppointmentStatus) {
    super(
      'Only pending or confirmed appointments can be rescheduled. Book a new one instead.',
      { status },
    );
  }
}

export class CancellationReasonRequiredError extends DomainError {
  readonly code = 'CANCELLATION_REASON_REQUIRED';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    super('Cancelling an appointment that is in progress requires a reason.');
  }
}

export class NoShowBeforeStartError extends DomainError {
  readonly code = 'NO_SHOW_BEFORE_START';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('A client cannot miss an appointment that has not started yet.');
  }
}

export class ServiceNotBookableError extends DomainError {
  readonly code = 'SERVICE_NOT_BOOKABLE';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('That service is not active, so it cannot be booked (rule CA-4).');
  }
}

export class StaffMemberNotBookableError extends DomainError {
  readonly code = 'STAFF_MEMBER_NOT_BOOKABLE';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('That staff member is not active, so they cannot take bookings.');
  }
}

export class AgendaRangeTooWideError extends DomainError {
  readonly code = 'AGENDA_RANGE_TOO_WIDE';
  readonly category = DomainErrorCategory.Validation;

  constructor(maxDays: number) {
    super(`An agenda query cannot span more than ${maxDays} days.`, {
      maxDays,
    });
  }
}

export class InvalidAppointmentDataError extends DomainError {
  readonly code = 'INVALID_APPOINTMENT_DATA';
  readonly category = DomainErrorCategory.Validation;

  constructor(field: string, reason: string) {
    super(`Invalid appointment ${field}: ${reason}`, { field });
  }
}

/** A STAFF user may only book and manage appointments of their own agenda. */
export class OwnAgendaOnlyError extends DomainError {
  readonly code = 'OWN_AGENDA_ONLY';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('Staff can only manage appointments in their own agenda.');
  }
}

/** Booking outside working hours or during time off is an OWNER/ADMIN decision. */
export class ScheduleOverrideNotAllowedError extends DomainError {
  readonly code = 'SCHEDULE_OVERRIDE_NOT_ALLOWED';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('Only an OWNER or ADMIN can book outside the working schedule.');
  }
}
