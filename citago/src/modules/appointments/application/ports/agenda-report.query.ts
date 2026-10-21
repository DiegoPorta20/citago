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
