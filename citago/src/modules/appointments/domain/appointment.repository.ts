import type { Page, PageRequest } from '../../../shared/domain/pagination.js';
import type { TimeRange } from '../../../shared/domain/time-range.js';
import type {
  Appointment,
  AppointmentStatusChange,
} from './appointment.entity.js';
import type { AppointmentStatus } from './appointment-status.js';

export interface AgendaFilters {
  readonly range: TimeRange;
  readonly staffMemberId?: string;
  readonly clientId?: string;
  readonly status?: AppointmentStatus;
}

export abstract class AppointmentRepository {
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Appointment | null>;

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

  abstract save(appointment: Appointment): Promise<void>;
}
