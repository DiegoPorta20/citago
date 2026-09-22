import { Injectable } from '@nestjs/common';

import type { TimeRange } from '../../../../../shared/domain/time-range.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import {
  AgendaReportQuery,
  type AgendaReportFilters,
  type StaffMemberAppointments,
  type StatusCount,
} from '../../../application/ports/agenda-report.query.js';
import { AppointmentStatus } from '../../../domain/appointment-status.js';
import { AppointmentOrmEntity } from './entities/appointment.orm-entity.js';

const count = (value: string | number): number => Number(value);

interface StatusRow {
  status: AppointmentStatus;
  appointments: string | number;
}

interface StaffRow {
  staffMemberId: string;
  status: AppointmentStatus;
  appointments: string | number;
}

/**
 * Agenda counters, computed by MySQL.
 *
 * Served by `ix_appointments_start` and `ix_appointments_staff_start`: tenant
 * and start time lead both indexes, so a period reads only its own rows.
 */
@Injectable()
export class TypeOrmAgendaReportQuery extends AgendaReportQuery {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get appointments() {
    return this.context.manager.getRepository(AppointmentOrmEntity);
  }

  async countByStatus(
    tenantId: string,
    range: TimeRange,
    filters: AgendaReportFilters = {},
  ): Promise<StatusCount[]> {
    const query = this.appointments
      .createQueryBuilder('appointment')
      .where('appointment.tenant_id = :tenantId', { tenantId })
      .andWhere('appointment.start_at >= :from', { from: range.start })
      .andWhere('appointment.start_at < :to', { to: range.end });

    if (filters.staffMemberId) {
      query.andWhere('appointment.staff_member_id = :staffMemberId', {
        staffMemberId: filters.staffMemberId,
      });
    }

    const rows = await query
      .select('appointment.status', 'status')
      .addSelect('COUNT(*)', 'appointments')
      .groupBy('appointment.status')
      .getRawMany<StatusRow>();

    return rows.map((row) => ({
      status: row.status,
      count: count(row.appointments),
    }));
  }

  async byStaffMember(
    tenantId: string,
    range: TimeRange,
  ): Promise<StaffMemberAppointments[]> {
    const rows = await this.appointments
      .createQueryBuilder('appointment')
      .where('appointment.tenant_id = :tenantId', { tenantId })
      .andWhere('appointment.start_at >= :from', { from: range.start })
      .andWhere('appointment.start_at < :to', { to: range.end })
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: [AppointmentStatus.Completed, AppointmentStatus.NoShow],
      })
      .select('appointment.staff_member_id', 'staffMemberId')
      .addSelect('appointment.status', 'status')
      .addSelect('COUNT(*)', 'appointments')
      .groupBy('appointment.staff_member_id')
      .addGroupBy('appointment.status')
      .getRawMany<StaffRow>();

    const byStaff = new Map<string, { completed: number; noShow: number }>();

    for (const row of rows) {
      const entry = byStaff.get(row.staffMemberId) ?? {
        completed: 0,
        noShow: 0,
      };

      if (row.status === AppointmentStatus.Completed) {
        entry.completed = count(row.appointments);
      } else {
        entry.noShow = count(row.appointments);
      }

      byStaff.set(row.staffMemberId, entry);
    }

    return [...byStaff].map(([staffMemberId, counts]) => ({
      staffMemberId,
      ...counts,
    }));
  }
}
