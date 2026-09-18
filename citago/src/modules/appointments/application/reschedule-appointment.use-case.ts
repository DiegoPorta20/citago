import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import { StaffAgendaLock } from '../../staff/application/ports/staff-agenda-lock.port.js';
import type { Appointment } from '../domain/appointment.entity.js';
import { AppointmentNotFoundError } from '../domain/appointment.errors.js';
import { AppointmentRepository } from '../domain/appointment.repository.js';
import { AgendaAccess } from './agenda-access.js';
import { BookingRules } from './booking-rules.js';

export interface RescheduleAppointmentInput {
  readonly appointmentId: string;
  readonly startAt?: Date;
  readonly staffMemberId?: string;
  /** `null` or empty clears the notes. */
  readonly notes?: string | null;
  readonly allowOutsideSchedule?: boolean;
}

/**
 * Moves an appointment to another time and/or staff member, or edits its notes.
 *
 * Duration and price travel with it unchanged: they were agreed at booking.
 * Changing the service is not a reschedule — cancel and book again, so the
 * history shows what was actually agreed each time.
 */
@Injectable()
export class RescheduleAppointmentUseCase {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly rules: BookingRules,
    private readonly access: AgendaAccess,
    private readonly agendaLock: StaffAgendaLock,
    private readonly transaction: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: RescheduleAppointmentInput,
  ): Promise<Appointment> {
    const allowOutsideSchedule = input.allowOutsideSchedule ?? false;

    if (allowOutsideSchedule) {
      this.access.assertCanOverrideSchedule(actor);
    }
    if (input.staffMemberId) {
      await this.access.assertCanManageStaff(actor, input.staffMemberId);
    }

    return this.transaction.run(async () => {
      const current = await this.load(actor, input.appointmentId);
      const moves =
        input.startAt !== undefined || input.staffMemberId !== undefined;

      if (moves) {
        // Both agendas are touched when moving between barbers; the lock
        // takes them in a fixed order so two opposite moves cannot deadlock.
        await this.agendaLock.acquire(actor.tenantId, [
          current.staffMemberId,
          input.staffMemberId ?? current.staffMemberId,
        ]);
      }

      // Re-read under the lock: what we checked must be what we change.
      const appointment = moves
        ? await this.load(actor, input.appointmentId)
        : current;
      const now = this.clock.now();

      if (moves) {
        appointment.reschedule(
          { startAt: input.startAt, staffMemberId: input.staffMemberId },
          now,
        );

        const staffMember = await this.rules.bookableStaffMember(
          actor.tenantId,
          appointment.staffMemberId,
        );

        await this.rules.assertSlotIsBookable({
          tenantId: actor.tenantId,
          staffMember,
          range: appointment.range,
          calendar: await this.rules.calendarFor(actor.tenantId),
          allowOutsideSchedule,
          ignoreAppointmentId: appointment.id,
        });
      }

      if (input.notes !== undefined) {
        appointment.changeNotes(input.notes, now);
      }

      await this.appointments.save(appointment);

      return appointment;
    });
  }

  private async load(actor: AuthContext, id: string): Promise<Appointment> {
    const appointment = await this.appointments.findByIdForTenant(
      id,
      actor.tenantId,
    );

    if (!appointment) {
      throw new AppointmentNotFoundError();
    }

    await this.access.assertCanSee(actor, appointment);

    return appointment;
  }
}
