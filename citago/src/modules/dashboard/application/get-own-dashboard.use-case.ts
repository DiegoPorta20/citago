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
  readonly staffMemberId: string | null;
  readonly appointments: AppointmentCounters;
}

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
