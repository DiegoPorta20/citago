import { Injectable } from '@nestjs/common';
import { LessThan, MoreThan } from 'typeorm';

import { IdGenerator } from '../../../../../shared/application/ports/id-generator.port.js';
import {
  buildPage,
  offsetOf,
  type Page,
  type PageRequest,
} from '../../../../../shared/domain/pagination.js';
import type { TimeRange } from '../../../../../shared/domain/time-range.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import {
  Appointment,
  type AppointmentStatusChange,
} from '../../../domain/appointment.entity.js';
import {
  AppointmentRepository,
  type AgendaFilters,
} from '../../../domain/appointment.repository.js';
import type { AppointmentStatus } from '../../../domain/appointment-status.js';
import { AppointmentOrmEntity } from './entities/appointment.orm-entity.js';
import { AppointmentStatusHistoryOrmEntity } from './entities/appointment-status-history.orm-entity.js';

@Injectable()
export class TypeOrmAppointmentRepository extends AppointmentRepository {
  constructor(
    private readonly context: TransactionalEntityManager,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  private get appointments() {
    return this.context.manager.getRepository(AppointmentOrmEntity);
  }

  private get history() {
    return this.context.manager.getRepository(
      AppointmentStatusHistoryOrmEntity,
    );
  }

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Appointment | null> {
    const row = await this.appointments.findOneBy({ id, tenantId });

    return row ? this.toDomain(row) : null;
  }

  async findOverlapping(
    tenantId: string,
    staffMemberId: string,
    range: TimeRange,
  ): Promise<Appointment[]> {
    // Half-open overlap: starts before the range ends and ends after it starts.
    // Served by ix_appointments_staff_start (tenant_id, staff_member_id, start_at).
    const rows = await this.appointments.find({
      where: {
        tenantId,
        staffMemberId,
        startAt: LessThan(range.end),
        endAt: MoreThan(range.start),
      },
      order: { startAt: 'ASC' },
    });

    return rows.map((row) => this.toDomain(row));
  }

  async list(
    tenantId: string,
    filters: AgendaFilters,
    page: PageRequest,
  ): Promise<Page<Appointment>> {
    const query = this.appointments
      .createQueryBuilder('appointment')
      .where('appointment.tenant_id = :tenantId', { tenantId })
      .andWhere('appointment.start_at < :rangeEnd', {
        rangeEnd: filters.range.end,
      })
      .andWhere('appointment.end_at > :rangeStart', {
        rangeStart: filters.range.start,
      });

    if (filters.staffMemberId) {
      query.andWhere('appointment.staff_member_id = :staffMemberId', {
        staffMemberId: filters.staffMemberId,
      });
    }
    if (filters.clientId) {
      query.andWhere('appointment.client_id = :clientId', {
        clientId: filters.clientId,
      });
    }
    if (filters.status) {
      query.andWhere('appointment.status = :status', {
        status: filters.status,
      });
    }

    const [rows, total] = await query
      .orderBy('appointment.start_at', 'ASC')
      .addOrderBy('appointment.id', 'ASC')
      .skip(offsetOf(page))
      .take(page.limit)
      .getManyAndCount();

    return buildPage(
      rows.map((row) => this.toDomain(row)),
      total,
      page,
    );
  }

  async listStatusHistory(
    tenantId: string,
    appointmentId: string,
  ): Promise<AppointmentStatusChange[]> {
    const rows = await this.history.find({
      where: { tenantId, appointmentId },
      order: { changedAt: 'ASC', id: 'ASC' },
    });

    return rows.map((row) => ({
      fromStatus: row.fromStatus as AppointmentStatus | null,
      toStatus: row.toStatus as AppointmentStatus,
      reason: row.reason,
      changedByUserId: row.changedByUserId,
      changedAt: row.changedAt,
    }));
  }

  async save(appointment: Appointment): Promise<void> {
    const snapshot = appointment.toSnapshot();
    const changes = appointment.pullStatusChanges();
    const row = new AppointmentOrmEntity();

    row.id = snapshot.id;
    row.tenantId = snapshot.tenantId;
    row.clientId = snapshot.clientId;
    row.serviceId = snapshot.serviceId;
    row.staffMemberId = snapshot.staffMemberId;
    row.startAt = snapshot.startAt;
    row.endAt = snapshot.endAt;
    row.status = snapshot.status;
    row.price = snapshot.price;
    row.notes = snapshot.notes;
    row.source = snapshot.source;
    row.createdByUserId = snapshot.createdByUserId;
    row.completedAt = snapshot.completedAt;
    row.cancelledAt = snapshot.cancelledAt;
    row.cancellationReason = snapshot.cancellationReason;
    row.createdAt = snapshot.createdAt;
    row.updatedAt = snapshot.updatedAt;

    await this.appointments.save(row);

    if (changes.length > 0) {
      await this.history.insert(
        changes.map((change) => ({
          id: this.ids.generate(),
          tenantId: snapshot.tenantId,
          appointmentId: snapshot.id,
          fromStatus: change.fromStatus,
          toStatus: change.toStatus,
          reason: change.reason,
          changedByUserId: change.changedByUserId,
          changedAt: change.changedAt,
        })),
      );
    }
  }

  private toDomain(row: AppointmentOrmEntity): Appointment {
    return Appointment.restore({
      id: row.id,
      tenantId: row.tenantId,
      clientId: row.clientId,
      serviceId: row.serviceId,
      staffMemberId: row.staffMemberId,
      startAt: row.startAt,
      endAt: row.endAt,
      status: row.status,
      price: row.price,
      notes: row.notes,
      source: row.source,
      createdByUserId: row.createdByUserId,
      completedAt: row.completedAt,
      cancelledAt: row.cancelledAt,
      cancellationReason: row.cancellationReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
