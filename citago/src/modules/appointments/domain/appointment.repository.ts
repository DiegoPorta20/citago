import type { Page, PageRequest } from '../../../shared/domain/pagination.js';
import type { TimeRange } from '../../../shared/domain/time-range.js';
import type {
  Appointment,
  AppointmentStatusChange,
} from './appointment.entity.js';
import type { AppointmentStatus } from './appointment-status.js';

export interface AgendaFilters {
  /** Appointments that overlap this range. Required: an agenda is always bounded. */
  readonly range: TimeRange;
  readonly staffMemberId?: string;
  readonly clientId?: string;
  readonly status?: AppointmentStatus;
}

/**
 * Persistence contract for appointments.
 *
 * **Every method takes `tenantId`** (see docs/adr/0004-tenant-isolation.md).
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class AppointmentRepository {
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Appointment | null>;

  /**
   * All appointments of a staff member that overlap `range`, **whatever their
   * status**: which statuses block is a domain rule, applied by the policy.
   */
  abstract findOverlapping(
    tenantId: string,
    staffMemberId: string,
    range: TimeRange,
  ): Promise<Appointment[]>;

  abstract list(
    tenantId: string,
    filters: AgendaFilters,
    page: PageRequest,
  ): Promise<Page<Appointment>>;

  abstract listStatusHistory(
    tenantId: string,
    appointmentId: string,
  ): Promise<AppointmentStatusChange[]>;

  /** Persists the appointment and appends its pending status changes. */
  abstract save(appointment: Appointment): Promise<void>;
}
