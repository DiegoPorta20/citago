import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import {
  buildPage,
  type Page,
  type PageRequest,
} from '../../../shared/domain/pagination.js';
import { TimeRange } from '../../../shared/domain/time-range.js';
import { ServiceRepository } from '../../catalog/domain/service.repository.js';
import { ClientRepository } from '../../clients/domain/client.repository.js';
import { StaffRepository } from '../../staff/domain/staff.repository.js';
import type {
  Appointment,
  AppointmentStatusChange,
} from '../domain/appointment.entity.js';
import {
  AgendaRangeTooWideError,
  AppointmentNotFoundError,
} from '../domain/appointment.errors.js';
import { AppointmentRepository } from '../domain/appointment.repository.js';
import type { AppointmentStatus } from '../domain/appointment-status.js';
import {
  StaffAvailabilityPolicy,
  type FreeSlot,
} from '../domain/staff-availability.policy.js';
import { AgendaAccess } from './agenda-access.js';
import { BookingRules } from './booking-rules.js';

/** Two months: enough for any calendar view, small enough to stay cheap. */
const MAX_AGENDA_DAYS = 62;
/** Availability is offered every 15 minutes from the start of each shift. */
const SLOT_STEP_MINUTES = 15;

/** An appointment with the names a screen needs, resolved in bulk. */
export interface AppointmentView {
  readonly appointment: Appointment;
  readonly client: {
    readonly id: string;
    readonly name: string;
    readonly phone: string | null;
  } | null;
  readonly service: { readonly id: string; readonly name: string } | null;
  readonly staffMember: {
    readonly id: string;
    readonly displayName: string;
  } | null;
}

/**
 * Attaches client, service and staff names to a batch of appointments.
 *
 * Three queries for the whole page, whatever its size — never one per row —
 * and each through the owning module's repository, never its tables.
 */
@Injectable()
export class AppointmentViewAssembler {
  constructor(
    private readonly clients: ClientRepository,
    private readonly services: ServiceRepository,
    private readonly staff: StaffRepository,
  ) {}

  async assemble(
    tenantId: string,
    appointments: readonly Appointment[],
  ): Promise<AppointmentView[]> {
    const unique = (values: string[]) => [...new Set(values)];

    const [clients, services, staff] = await Promise.all([
      this.clients.findManyByIdsForTenant(
        unique(appointments.map((a) => a.clientId)),
        tenantId,
      ),
      this.services.findManyByIdsForTenant(
        unique(appointments.map((a) => a.serviceId)),
        tenantId,
      ),
      this.staff.findManyByIdsForTenant(
        unique(appointments.map((a) => a.staffMemberId)),
        tenantId,
      ),
    ]);

    const clientById = new Map(clients.map((c) => [c.id, c]));
    const serviceById = new Map(services.map((s) => [s.id, s]));
    const staffById = new Map(staff.map((m) => [m.id, m]));

    return appointments.map((appointment) => {
      const client = clientById.get(appointment.clientId);
      const service = serviceById.get(appointment.serviceId);
      const member = staffById.get(appointment.staffMemberId);

      return {
        appointment,
        client: client
          ? {
              id: client.id,
              name: client.name,
              phone: client.phone?.value ?? null,
            }
          : null,
        service: service ? { id: service.id, name: service.name } : null,
        staffMember: member
          ? { id: member.id, displayName: member.displayName }
          : null,
      };
    });
  }
}

@Injectable()
export class GetAppointmentUseCase {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly access: AgendaAccess,
    private readonly assembler: AppointmentViewAssembler,
  ) {}

  async execute(
    actor: AuthContext,
    appointmentId: string,
  ): Promise<{ view: AppointmentView; history: AppointmentStatusChange[] }> {
    const appointment = await this.appointments.findByIdForTenant(
      appointmentId,
      actor.tenantId,
    );

    if (!appointment) {
      throw new AppointmentNotFoundError();
    }

    await this.access.assertCanSee(actor, appointment);

    const [[view], history] = await Promise.all([
      this.assembler.assemble(actor.tenantId, [appointment]),
      this.appointments.listStatusHistory(actor.tenantId, appointment.id),
    ]);

    return { view, history };
  }
}

export interface ListAgendaInput extends PageRequest {
  readonly from: Date;
  readonly to: Date;
  readonly staffMemberId?: string;
  readonly clientId?: string;
  readonly status?: AppointmentStatus;
}

/**
 * The agenda: appointments overlapping a time range.
 *
 * STAFF users see only their own agenda, whatever filter they send
 * (docs/permissions.md). A STAFF account not linked to a staff member sees an
 * empty agenda rather than an error.
 */
@Injectable()
export class ListAgendaUseCase {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly access: AgendaAccess,
    private readonly assembler: AppointmentViewAssembler,
  ) {}

  async execute(
    actor: AuthContext,
    input: ListAgendaInput,
  ): Promise<Page<AppointmentView>> {
    const range = TimeRange.of(input.from, input.to);

    if (range.durationMinutes > MAX_AGENDA_DAYS * 24 * 60) {
      throw new AgendaRangeTooWideError(MAX_AGENDA_DAYS);
    }

    const scope = await this.access.scopeFor(actor);
    const page = { page: input.page, limit: input.limit };

    if (scope.kind === 'own' && scope.staffMemberId === null) {
      return buildPage([], 0, page);
    }

    const staffMemberId =
      scope.kind === 'own' ? scope.staffMemberId : input.staffMemberId;

    // A STAFF user asking for someone else's agenda simply gets their own.
    if (
      scope.kind === 'own' &&
      input.staffMemberId !== undefined &&
      input.staffMemberId !== scope.staffMemberId
    ) {
      return buildPage([], 0, page);
    }

    const result = await this.appointments.list(
      actor.tenantId,
      {
        range,
        staffMemberId: staffMemberId ?? undefined,
        clientId: input.clientId,
        status: input.status,
      },
      page,
    );

    return {
      items: await this.assembler.assemble(actor.tenantId, result.items),
      meta: result.meta,
    };
  }
}

export interface AvailabilityResult {
  readonly date: string;
  readonly timezone: string;
  readonly durationMinutes: number;
  readonly slots: readonly (FreeSlot & { readonly localTime: string })[];
}

/**
 * Free start times for a service with a staff member on a local date.
 *
 * Advisory: the slot is only guaranteed at booking time, under the agenda
 * lock. Two people looking at the same free slot is normal; only one of them
 * gets it.
 */
@Injectable()
export class GetAvailabilityUseCase {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly staff: StaffRepository,
    private readonly rules: BookingRules,
    private readonly access: AgendaAccess,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: {
      readonly staffMemberId: string;
      readonly serviceId: string;
      /** Local date, `YYYY-MM-DD`, in the business time zone. */
      readonly date: string;
    },
  ): Promise<AvailabilityResult> {
    await this.access.assertCanManageStaff(actor, input.staffMemberId);

    const calendar = await this.rules.calendarFor(actor.tenantId);
    const staffMember = await this.rules.bookableStaffMember(
      actor.tenantId,
      input.staffMemberId,
    );
    const service = await this.rules.bookableService(
      actor.tenantId,
      input.serviceId,
    );
    const day = calendar.dayRange(input.date);

    const [appointments, timeOff] = await Promise.all([
      this.appointments.findOverlapping(actor.tenantId, staffMember.id, day),
      this.staff.listTimeOff(actor.tenantId, staffMember.id, day),
    ]);

    const slots = StaffAvailabilityPolicy.freeSlots({
      calendar,
      schedule: staffMember.schedule,
      timeOff,
      localDate: input.date,
      durationMinutes: service.durationMinutes,
      busy: appointments
        .filter((appointment) => appointment.isBlocking)
        .map((appointment) => appointment.range),
      notBefore: this.clock.now(),
      stepMinutes: SLOT_STEP_MINUTES,
    });

    return {
      date: input.date,
      timezone: calendar.timezone,
      durationMinutes: service.durationMinutes,
      slots: slots.map((slot) => ({
        ...slot,
        localTime: calendar.localTimeOf(slot.startAt),
      })),
    };
  }
}
