import { Injectable } from '@nestjs/common';
import { In, LessThan, MoreThan, type EntityManager } from 'typeorm';

import { IdGenerator } from '../../../../../shared/application/ports/id-generator.port.js';
import { TimeOfDay } from '../../../../../shared/domain/time-of-day.js';
import type { TimeRange } from '../../../../../shared/domain/time-range.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { StaffMember } from '../../../domain/staff-member.entity.js';
import { StaffTimeOff } from '../../../domain/staff-time-off.entity.js';
import { StaffRepository } from '../../../domain/staff.repository.js';
import {
  WeeklySchedule,
  type Weekday,
} from '../../../../../shared/domain/weekly-schedule.js';
import { StaffMemberOrmEntity } from './entities/staff-member.orm-entity.js';
import { StaffScheduleOrmEntity } from './entities/staff-schedule.orm-entity.js';
import { StaffTimeOffOrmEntity } from './entities/staff-time-off.orm-entity.js';

@Injectable()
export class TypeOrmStaffRepository extends StaffRepository {
  constructor(
    private readonly context: TransactionalEntityManager,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<StaffMember | null> {
    const row = await this.members().findOneBy({ id, tenantId });

    return row ? (await this.hydrate([row]))[0] : null;
  }

  async findManyByIdsForTenant(
    ids: readonly string[],
    tenantId: string,
  ): Promise<StaffMember[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.members().findBy({ id: In([...ids]), tenantId });

    return this.hydrate(rows);
  }

  async findByUserId(
    tenantId: string,
    userId: string,
  ): Promise<StaffMember | null> {
    const row = await this.members().findOneBy({ tenantId, userId });

    return row ? (await this.hydrate([row]))[0] : null;
  }

  async list(tenantId: string): Promise<StaffMember[]> {
    const rows = await this.members().find({
      where: { tenantId },
      order: { displayName: 'ASC', id: 'ASC' },
    });

    return this.hydrate(rows);
  }

  async save(member: StaffMember): Promise<void> {
    const snapshot = member.toSnapshot();

    // The member and its schedule are one aggregate: replacing the ranges must
    // never leave a half-written week behind.
    await this.inTransaction(async (manager) => {
      const row = new StaffMemberOrmEntity();
      row.id = snapshot.id;
      row.tenantId = snapshot.tenantId;
      row.userId = snapshot.userId;
      row.displayName = snapshot.displayName;
      row.status = snapshot.status;
      row.createdAt = snapshot.createdAt;
      row.updatedAt = snapshot.updatedAt;

      await manager.getRepository(StaffMemberOrmEntity).save(row);

      const schedules = manager.getRepository(StaffScheduleOrmEntity);
      await schedules.delete({
        tenantId: snapshot.tenantId,
        staffMemberId: snapshot.id,
      });

      const ranges = snapshot.schedule.all();

      if (ranges.length > 0) {
        await schedules.insert(
          ranges.map((range) => ({
            id: this.ids.generate(),
            tenantId: snapshot.tenantId,
            staffMemberId: snapshot.id,
            weekday: range.weekday,
            startsAt: `${range.startsAt.toString()}:00`,
            endsAt: `${range.endsAt.toString()}:00`,
          })),
        );
      }
    });
  }

  async findTimeOffForTenant(
    id: string,
    tenantId: string,
  ): Promise<StaffTimeOff | null> {
    const row = await this.timeOff().findOneBy({ id, tenantId });

    return row ? this.toTimeOff(row) : null;
  }

  async listTimeOff(
    tenantId: string,
    staffMemberId: string,
    range: TimeRange,
  ): Promise<StaffTimeOff[]> {
    // Half-open overlap: starts before the range ends, ends after it starts.
    const rows = await this.timeOff().find({
      where: {
        tenantId,
        staffMemberId,
        startsAt: LessThan(range.end),
        endsAt: MoreThan(range.start),
      },
      order: { startsAt: 'ASC' },
    });

    return rows.map((row) => this.toTimeOff(row));
  }

  async saveTimeOff(timeOff: StaffTimeOff): Promise<void> {
    const snapshot = timeOff.toSnapshot();

    await this.timeOff().save({
      id: snapshot.id,
      tenantId: snapshot.tenantId,
      staffMemberId: snapshot.staffMemberId,
      startsAt: snapshot.startsAt,
      endsAt: snapshot.endsAt,
      reason: snapshot.reason,
      createdAt: snapshot.createdAt,
    });
  }

  async deleteTimeOff(id: string, tenantId: string): Promise<void> {
    // Scoped delete: an id from another tenant deletes nothing.
    await this.timeOff().delete({ id, tenantId });
  }

  private members() {
    return this.context.manager.getRepository(StaffMemberOrmEntity);
  }

  private timeOff() {
    return this.context.manager.getRepository(StaffTimeOffOrmEntity);
  }

  private inTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.context.isInTransaction
      ? work(this.context.manager)
      : this.context.manager.transaction(work);
  }

  /** Loads the schedules of all given members in one query: no N+1. */
  private async hydrate(rows: StaffMemberOrmEntity[]): Promise<StaffMember[]> {
    if (rows.length === 0) {
      return [];
    }

    const scheduleRows = await this.context.manager
      .getRepository(StaffScheduleOrmEntity)
      .find({
        where: {
          tenantId: rows[0].tenantId,
          staffMemberId: In(rows.map((row) => row.id)),
        },
        order: { weekday: 'ASC', startsAt: 'ASC' },
      });

    return rows.map((row) =>
      StaffMember.restore({
        id: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        displayName: row.displayName,
        status: row.status,
        schedule: WeeklySchedule.restore(
          scheduleRows
            .filter((schedule) => schedule.staffMemberId === row.id)
            .map((schedule) => ({
              weekday: Number(schedule.weekday) as Weekday,
              startsAt: TimeOfDay.parse(schedule.startsAt),
              endsAt: TimeOfDay.parse(schedule.endsAt),
            })),
        ),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  private toTimeOff(row: StaffTimeOffOrmEntity): StaffTimeOff {
    return StaffTimeOff.restore({
      id: row.id,
      tenantId: row.tenantId,
      staffMemberId: row.staffMemberId,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      reason: row.reason,
      createdAt: row.createdAt,
    });
  }
}
