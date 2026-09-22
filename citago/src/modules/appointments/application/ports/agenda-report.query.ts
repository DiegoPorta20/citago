import type { TimeRange } from '../../../../shared/domain/time-range.js';
import type { AppointmentStatus } from '../../domain/appointment-status.js';

export interface AgendaReportFilters {
  readonly staffMemberId?: string;
}

export interface StatusCount {
  readonly status: AppointmentStatus;
  readonly count: number;
}

export interface StaffMemberAppointments {
  readonly staffMemberId: string;
  readonly completed: number;
  readonly noShow: number;
}

/**
 * Aggregated reads over the agenda, for the dashboard.
 *
 * Counts appointments by their **start**, so an appointment belongs to the day
 * it was booked for — which is the day the business means when it asks "how did
 * Tuesday go?".
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class AgendaReportQuery {
  abstract countByStatus(
    tenantId: string,
    range: TimeRange,
    filters?: AgendaReportFilters,
  ): Promise<StatusCount[]>;

  abstract byStaffMember(
    tenantId: string,
    range: TimeRange,
  ): Promise<StaffMemberAppointments[]>;
}
