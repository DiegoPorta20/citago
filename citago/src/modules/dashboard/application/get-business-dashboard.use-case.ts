import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import {
  AgendaReportQuery,
  type StatusCount,
} from '../../appointments/application/ports/agenda-report.query.js';
import { AppointmentStatus } from '../../appointments/domain/appointment-status.js';
import { ClientRepository } from '../../clients/domain/client.repository.js';
import {
  SalesReportQuery,
  type PaymentMethodTotal,
  type SalesTotals,
  type ServiceSales,
} from '../../sales/application/ports/sales-report.query.js';
import { StaffRepository } from '../../staff/domain/staff.repository.js';
import { DashboardPeriod, type PeriodInput } from './dashboard-period.js';

const TOP_SERVICES = 5;

export interface AppointmentCounters {
  readonly total: number;
  readonly byStatus: readonly StatusCount[];
  readonly completed: number;
  readonly cancelled: number;
  readonly noShow: number;
}

export interface StaffPerformance {
  readonly staffMemberId: string;
  readonly name: string;
  readonly completedAppointments: number;
  readonly noShowAppointments: number;
  readonly revenue: string;
  readonly saleCount: number;
}

export interface BusinessDashboard {
  readonly period: {
    readonly from: string;
    readonly to: string;
    readonly timezone: string;
  };
  readonly currency: string;
  readonly revenue: SalesTotals & {
    readonly byPaymentMethod: readonly PaymentMethodTotal[];
  };
  readonly appointments: AppointmentCounters;
  readonly clients: { readonly created: number };
  readonly topServices: readonly ServiceSales[];
  readonly staff: readonly StaffPerformance[];
}

@Injectable()
export class GetBusinessDashboardUseCase {
  constructor(
    private readonly period: DashboardPeriod,
    private readonly sales: SalesReportQuery,
    private readonly agenda: AgendaReportQuery,
    private readonly clients: ClientRepository,
    private readonly staff: StaffRepository,
  ) {}

  async execute(
    actor: AuthContext,
    input: PeriodInput,
  ): Promise<BusinessDashboard> {
    const period = await this.period.resolve(actor.tenantId, input);
    const { tenantId } = actor;
    const { range } = period;

    const [
      totals,
      byPaymentMethod,
      statuses,
      newClients,
      topServices,
      salesByStaff,
      agendaByStaff,
      staffMembers,
    ] = await Promise.all([
      this.sales.totals(tenantId, range),
      this.sales.byPaymentMethod(tenantId, range),
      this.agenda.countByStatus(tenantId, range),
      this.clients.countCreatedBetween(tenantId, range),
      this.sales.topServices(tenantId, range, TOP_SERVICES),
      this.sales.byStaffMember(tenantId, range),
      this.agenda.byStaffMember(tenantId, range),
      this.staff.list(tenantId),
    ]);

    const salesOf = new Map(
      salesByStaff.map((row) => [row.staffMemberId, row]),
    );
    const agendaOf = new Map(
      agendaByStaff.map((row) => [row.staffMemberId, row]),
    );

    return {
      period: {
        from: period.from,
        to: period.to,
        timezone: period.timezone,
      },
      currency: period.currency,
      revenue: { ...totals, byPaymentMethod },
      appointments: countersOf(statuses),
      clients: { created: newClients },
      topServices,
      staff: staffMembers
        .map((member) => ({
          staffMemberId: member.id,
          name: member.displayName,
          completedAppointments: agendaOf.get(member.id)?.completed ?? 0,
          noShowAppointments: agendaOf.get(member.id)?.noShow ?? 0,
          revenue: salesOf.get(member.id)?.total ?? '0.00',
          saleCount: salesOf.get(member.id)?.count ?? 0,
        }))
        .sort((a, b) => b.completedAppointments - a.completedAppointments),
    };
  }
}

export function countersOf(
  statuses: readonly StatusCount[],
): AppointmentCounters {
  const countOf = (status: AppointmentStatus) =>
    statuses.find((row) => row.status === status)?.count ?? 0;

  return {
    total: statuses.reduce((sum, row) => sum + row.count, 0),
    byStatus: statuses,
    completed: countOf(AppointmentStatus.Completed),
    cancelled: countOf(AppointmentStatus.Cancelled),
    noShow: countOf(AppointmentStatus.NoShow),
  };
}
