import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import { StaffAgendaLock } from '../../staff/application/ports/staff-agenda-lock.port.js';
import { StaffRepository } from '../../staff/domain/staff.repository.js';
import { StaffMemberNotFoundError } from '../../staff/domain/staff.errors.js';
import type { Appointment } from '../domain/appointment.entity.js';
import { AppointmentNotFoundError } from '../domain/appointment.errors.js';
import { AppointmentRepository } from '../domain/appointment.repository.js';
import {
  type AppointmentStatus,
  isBlocking,
} from '../domain/appointment-status.js';
import { AgendaAccess } from './agenda-access.js';
import { BookingRules } from './booking-rules.js';

export interface TransitionAppointmentInput {
  readonly appointmentId: string;
  readonly target: AppointmentStatus;
  readonly reason?: string | null;
}

/**
 * Moves an appointment through its lifecycle: confirm, arrive, start,
 * complete, cancel, no-show.
 *
 * One use case rather than six: they are the same business action — "advance
 * this appointment" — and the rules that differ between them live in the
 * domain's state machine, not here. The HTTP layer still exposes one explicit
 * endpoint per action.
 *
 * The one subtle case: moving from a status that frees the slot to one that
 * occupies it (`NO_SHOW → COMPLETED`). Someone may have been booked into the
 * freed time meanwhile, so that path re-checks overlaps under the agenda lock.
 */
@Injectable()
export class TransitionAppointmentUseCase {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly staff: StaffRepository,
    private readonly rules: BookingRules,
    private readonly access: AgendaAccess,
    private readonly agendaLock: StaffAgendaLock,
    private readonly transaction: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: TransitionAppointmentInput,
  ): Promise<Appointment> {
    return this.transaction.run(async () => {
      let appointment = await this.load(actor, input.appointmentId);

      const reoccupies = !appointment.isBlocking && isBlocking(input.target);

      if (reoccupies) {
        await this.agendaLock.acquire(actor.tenantId, [
          appointment.staffMemberId,
        ]);
        appointment = await this.load(actor, input.appointmentId);

        const staffMember = await this.staff.findByIdForTenant(
          appointment.staffMemberId,
          actor.tenantId,
        );

        if (!staffMember) {
          throw new StaffMemberNotFoundError();
        }

        await this.rules.assertNoOverlap({
          tenantId: actor.tenantId,
          staffMember,
          range: appointment.range,
          ignoreAppointmentId: appointment.id,
        });
      }

      appointment.transitionTo(
        input.target,
        { actorUserId: actor.userId, reason: input.reason },
        this.clock.now(),
      );

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
