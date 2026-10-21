import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../shared/application/ports/id-generator.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import { TimeRange } from '../../../shared/domain/time-range.js';
import { StaffAgendaLock } from '../../staff/application/ports/staff-agenda-lock.port.js';
import { Appointment } from '../domain/appointment.entity.js';
import { AppointmentRepository } from '../domain/appointment.repository.js';
import { AppointmentSource } from '../domain/appointment-source.js';
import { AppointmentStatus } from '../domain/appointment-status.js';
import { AgendaAccess } from './agenda-access.js';
import { BookingRules } from './booking-rules.js';

export interface BookAppointmentInput {
  readonly clientId: string;
  readonly serviceId: string;
  readonly staffMemberId: string;
  readonly startAt: Date;
  readonly notes?: string | null;
  readonly initialStatus?:
    AppointmentStatus.Pending | AppointmentStatus.Confirmed;
  readonly allowOutsideSchedule?: boolean;
  readonly source?: AppointmentSource;
}

@Injectable()
export class BookAppointmentUseCase {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly rules: BookingRules,
    private readonly access: AgendaAccess,
    private readonly agendaLock: StaffAgendaLock,
    private readonly transaction: TransactionRunner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: BookAppointmentInput,
  ): Promise<Appointment> {
    await this.access.assertCanManageStaff(actor, input.staffMemberId);

    const allowOutsideSchedule = input.allowOutsideSchedule ?? false;

    if (allowOutsideSchedule) {
      this.access.assertCanOverrideSchedule(actor);
    }

    return this.transaction.run(async () => {
      await this.agendaLock.acquire(actor.tenantId, [input.staffMemberId]);

      const staffMember = await this.rules.bookableStaffMember(
        actor.tenantId,
        input.staffMemberId,
      );
      const service = await this.rules.bookableService(
        actor.tenantId,
        input.serviceId,
      );
      await this.rules.bookableClient(actor.tenantId, input.clientId);

      const range = TimeRange.of(
        input.startAt,
        new Date(input.startAt.getTime() + service.durationMinutes * 60_000),
      );

      await this.rules.assertSlotIsBookable({
        tenantId: actor.tenantId,
        staffMember,
        range,
        calendar: await this.rules.calendarFor(actor.tenantId),
        allowOutsideSchedule,
      });

      const appointment = Appointment.book(
        {
          id: this.ids.generate(),
          tenantId: actor.tenantId,
          clientId: input.clientId,
          serviceId: service.id,
          staffMemberId: staffMember.id,
          range,
          price: service.price,
          notes: input.notes,
          source: input.source ?? AppointmentSource.Manual,
          initialStatus: input.initialStatus ?? AppointmentStatus.Pending,
          createdByUserId: actor.userId,
        },
        this.clock.now(),
      );

      await this.appointments.save(appointment);

      return appointment;
    });
  }
}
