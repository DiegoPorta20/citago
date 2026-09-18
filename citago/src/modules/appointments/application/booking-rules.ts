import { Injectable } from '@nestjs/common';

import { Clock } from '../../../shared/application/ports/clock.port.js';
import { BusinessCalendar } from '../../../shared/domain/business-calendar.js';
import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';
import type { TimeRange } from '../../../shared/domain/time-range.js';
import { ServiceRepository } from '../../catalog/domain/service.repository.js';
import type { Service } from '../../catalog/domain/service.entity.js';
import { ClientRepository } from '../../clients/domain/client.repository.js';
import type { Client } from '../../clients/domain/client.entity.js';
import { ClientNotFoundError } from '../../clients/domain/errors/clients.errors.js';
import { ServiceNotFoundError } from '../../catalog/domain/errors/catalog.errors.js';
import type { StaffMember } from '../../staff/domain/staff-member.entity.js';
import { StaffMemberNotFoundError } from '../../staff/domain/staff.errors.js';
import { StaffRepository } from '../../staff/domain/staff.repository.js';
import { TenantRepository } from '../../tenants/domain/tenant.repository.js';
import { AppointmentRepository } from '../domain/appointment.repository.js';
import {
  AppointmentInThePastError,
  ServiceNotBookableError,
  StaffMemberNotBookableError,
} from '../domain/appointment.errors.js';
import { AppointmentOverlapPolicy } from '../domain/appointment-overlap.policy.js';
import { StaffAvailabilityPolicy } from '../domain/staff-availability.policy.js';

class TenantNotAvailableError extends DomainError {
  readonly code = 'TENANT_NOT_AVAILABLE';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('The business of this session is not available.');
  }
}

export interface SlotCheck {
  readonly tenantId: string;
  readonly staffMember: StaffMember;
  readonly range: TimeRange;
  readonly calendar: BusinessCalendar;
  /** OWNER/ADMIN decision: book outside working hours, during time off or in the past. */
  readonly allowOutsideSchedule: boolean;
  /** When rescheduling, the appointment itself must not count as a conflict. */
  readonly ignoreAppointmentId?: string;
}

/**
 * The checks shared by booking, rescheduling and re-activating an appointment.
 *
 * One place so the three can never disagree about what a valid slot is.
 */
@Injectable()
export class BookingRules {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly services: ServiceRepository,
    private readonly clients: ClientRepository,
    private readonly staff: StaffRepository,
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async calendarFor(tenantId: string): Promise<BusinessCalendar> {
    const tenant = await this.tenants.findById(tenantId);

    if (!tenant) {
      throw new TenantNotAvailableError();
    }

    return new BusinessCalendar(tenant.timezone);
  }

  /** An active service of this tenant (rule CA-4). */
  async bookableService(tenantId: string, serviceId: string): Promise<Service> {
    const service = await this.services.findByIdForTenant(serviceId, tenantId);

    if (!service) {
      throw new ServiceNotFoundError();
    }
    if (!service.isActive) {
      throw new ServiceNotBookableError();
    }

    return service;
  }

  /** A non-deleted client of this tenant (rule AP-11 / CL-3). */
  async bookableClient(tenantId: string, clientId: string): Promise<Client> {
    const client = await this.clients.findByIdForTenant(clientId, tenantId);

    if (!client) {
      throw new ClientNotFoundError();
    }

    return client;
  }

  /** An active staff member of this tenant. */
  async bookableStaffMember(
    tenantId: string,
    staffMemberId: string,
  ): Promise<StaffMember> {
    const member = await this.staff.findByIdForTenant(staffMemberId, tenantId);

    if (!member) {
      throw new StaffMemberNotFoundError();
    }
    if (!member.isActive) {
      throw new StaffMemberNotBookableError();
    }

    return member;
  }

  /**
   * Validates a slot. **Must run after the staff agenda lock is held**,
   * otherwise the overlap check can race with another booking.
   */
  async assertSlotIsBookable(check: SlotCheck): Promise<void> {
    StaffAvailabilityPolicy.assertWithinOneDay(check.range, check.calendar);

    if (!check.allowOutsideSchedule) {
      if (check.range.start.getTime() < this.clock.now().getTime()) {
        throw new AppointmentInThePastError();
      }

      const timeOff = await this.staff.listTimeOff(
        check.tenantId,
        check.staffMember.id,
        check.range,
      );

      StaffAvailabilityPolicy.assertAvailable(check.range, {
        calendar: check.calendar,
        schedule: check.staffMember.schedule,
        timeOff,
      });
    }

    await this.assertNoOverlap(check);
  }

  /** The overlap rule alone: it applies even when the schedule is overridden. */
  async assertNoOverlap(
    check: Pick<
      SlotCheck,
      'tenantId' | 'staffMember' | 'range' | 'ignoreAppointmentId'
    >,
  ): Promise<void> {
    const existing = await this.appointments.findOverlapping(
      check.tenantId,
      check.staffMember.id,
      check.range,
    );

    AppointmentOverlapPolicy.assertNoOverlap(
      check.range,
      existing,
      check.ignoreAppointmentId,
    );
  }
}
