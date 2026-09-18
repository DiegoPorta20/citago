import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { StaffRepository } from '../../staff/domain/staff.repository.js';
import type { Appointment } from '../domain/appointment.entity.js';
import {
  AppointmentNotFoundError,
  OwnAgendaOnlyError,
  ScheduleOverrideNotAllowedError,
} from '../domain/appointment.errors.js';

/** Which agendas a caller can see. */
export type AgendaScope =
  | { readonly kind: 'all' }
  /** A STAFF user: only their staff member, or nothing if they have none. */
  | { readonly kind: 'own'; readonly staffMemberId: string | null };

/**
 * The per-resource half of authorization for appointments
 * (docs/permissions.md): OWNER and ADMIN manage every agenda, STAFF only their
 * own — "own" meaning the staff member linked to their account.
 *
 * The role check at the controller cannot express this, because it depends on
 * which appointment is being touched.
 */
@Injectable()
export class AgendaAccess {
  constructor(private readonly staff: StaffRepository) {}

  async scopeFor(actor: AuthContext): Promise<AgendaScope> {
    if (actor.role !== UserRole.Staff) {
      return { kind: 'all' };
    }

    const own = await this.staff.findByUserId(actor.tenantId, actor.userId);

    return { kind: 'own', staffMemberId: own?.id ?? null };
  }

  /** For writes: STAFF may only book or move appointments into their own agenda. */
  async assertCanManageStaff(
    actor: AuthContext,
    staffMemberId: string,
  ): Promise<void> {
    const scope = await this.scopeFor(actor);

    if (scope.kind === 'own' && scope.staffMemberId !== staffMemberId) {
      throw new OwnAgendaOnlyError();
    }
  }

  /**
   * For reads and lifecycle changes: an appointment outside the caller's
   * agenda is reported as not found, like any other invisible row.
   */
  async assertCanSee(
    actor: AuthContext,
    appointment: Appointment,
  ): Promise<void> {
    const scope = await this.scopeFor(actor);

    if (
      scope.kind === 'own' &&
      scope.staffMemberId !== appointment.staffMemberId
    ) {
      throw new AppointmentNotFoundError();
    }
  }

  /** Booking outside working hours, during time off or in the past (decision F17). */
  assertCanOverrideSchedule(actor: AuthContext): void {
    if (actor.role === UserRole.Staff) {
      throw new ScheduleOverrideNotAllowedError();
    }
  }
}
