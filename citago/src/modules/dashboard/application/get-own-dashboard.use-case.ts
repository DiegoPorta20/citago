import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { AgendaReportQuery } from '../../appointments/application/ports/agenda-report.query.js';
import { StaffScope } from '../../staff/application/staff-scope.js';
import { DashboardPeriod, type PeriodInput } from './dashboard-period.js';
import {
  countersOf,
  type AppointmentCounters,
} from './get-business-dashboard.use-case.js';

export interface OwnDashboard {
  readonly period: {
    readonly from: string;
    readonly to: string;
    readonly timezone: string;
  };
  /** Null for an account with no staff member: then every counter is zero. */
  readonly staffMemberId: string | null;
  readonly appointments: AppointmentCounters;
}

/**
 * What the person in front of the screen did: their own attentions for the
 * period, defaulting to today.
 *
 * Open to every member, including STAFF — it is the one dashboard they may see
 * (docs/permissions.md). It deliberately carries **no money**: whether a staff
 * member sees the revenue they generated is still an open product decision, and
 * the safe default is the one that cannot leak it.
 *
 * An OWNER or ADMIN asking for this sees their own agenda too, if their account
 * is linked to a staff member.
 */
@Injectable()
export class GetOwnDashboardUseCase {
  constructor(
    private readonly period: DashboardPeriod,
    private readonly agenda: AgendaReportQuery,
    private readonly scope: StaffScope,
  ) {}

  async execute(actor: AuthContext, input: PeriodInput): Promise<OwnDashboard> {
    const period = await this.period.resolve(actor.tenantId, input);
    const staffMemberId = await this.scope.staffMemberOf(actor);

    const statuses = staffMemberId
      ? await this.agenda.countByStatus(actor.tenantId, period.range, {
          staffMemberId,
        })
      : [];

    return {
      period: {
        from: period.from,
        to: period.to,
        timezone: period.timezone,
      },
      staffMemberId,
      appointments: countersOf(statuses),
    };
  }
}
