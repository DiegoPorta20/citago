import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import {
  StaffScope,
  type StaffScopeResult,
} from '../../staff/application/staff-scope.js';
import type { Appointment } from '../domain/appointment.entity.js';
import {
  AppointmentNotFoundError,
  OwnAgendaOnlyError,
  ScheduleOverrideNotAllowedError,
} from '../domain/appointment.errors.js';

export type AgendaScope = StaffScopeResult;

@Injectable()
export class AgendaAccess {
  constructor(private readonly scope: StaffScope) {}

  scopeFor(actor: AuthContext): Promise<AgendaScope> {
    return this.scope.forActor(actor);
  }

  async assertCanManageStaff(
    actor: AuthContext,
    staffMemberId: string,
  ): Promise<void> {
    const scope = await this.scopeFor(actor);

    if (scope.kind === 'own' && scope.staffMemberId !== staffMemberId) {
      throw new OwnAgendaOnlyError();
    }
  }

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

  assertCanOverrideSchedule(actor: AuthContext): void {
    if (actor.role === UserRole.Staff) {
      throw new ScheduleOverrideNotAllowedError();
    }
  }
}
