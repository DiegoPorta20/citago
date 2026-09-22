import { Injectable } from '@nestjs/common';

import { IdGenerator } from '../../../../../shared/application/ports/id-generator.port.js';
import { TimeOfDay } from '../../../../../shared/domain/time-of-day.js';
import {
  WeeklySchedule,
  type Weekday,
} from '../../../../../shared/domain/weekly-schedule.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import type { Tenant } from '../../../domain/tenant.entity.js';
import { TenantRepository } from '../../../domain/tenant.repository.js';
import { BusinessHoursOrmEntity } from './entities/business-hours.orm-entity.js';
import { TenantOrmEntity } from './entities/tenant.orm-entity.js';
import { TenantMapper } from './tenant.mapper.js';

@Injectable()
export class TypeOrmTenantRepository extends TenantRepository {
  constructor(
    private readonly context: TransactionalEntityManager,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  private get repository() {
    // Resolved per call so writes join the current transaction, if any.
    return this.context.manager.getRepository(TenantOrmEntity);
  }

  private get hours() {
    return this.context.manager.getRepository(BusinessHoursOrmEntity);
  }

  async findById(id: string): Promise<Tenant | null> {
    const row = await this.repository.findOneBy({ id });

    return row ? TenantMapper.toDomain(row) : null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return this.repository.existsBy({ slug });
  }

  async findHours(tenantId: string): Promise<WeeklySchedule> {
    const rows = await this.hours.find({
      where: { tenantId },
      order: { weekday: 'ASC', startsAt: 'ASC' },
    });

    return WeeklySchedule.restore(
      rows.map((row) => ({
        weekday: Number(row.weekday) as Weekday,
        startsAt: TimeOfDay.parse(row.startsAt),
        endsAt: TimeOfDay.parse(row.endsAt),
      })),
    );
  }

  async replaceHours(tenantId: string, hours: WeeklySchedule): Promise<void> {
    // Delete and insert rather than diff: the week is edited as one thing, and
    // a handful of rows makes any cleverness a loss.
    await this.hours.delete({ tenantId });

    const ranges = hours.all();

    if (ranges.length > 0) {
      await this.hours.insert(
        ranges.map((range) => ({
          id: this.ids.generate(),
          tenantId,
          weekday: range.weekday,
          startsAt: `${range.startsAt.toString()}:00`,
          endsAt: `${range.endsAt.toString()}:00`,
        })),
      );
    }
  }

  async save(tenant: Tenant): Promise<void> {
    await this.repository.save(TenantMapper.toPersistence(tenant));
  }
}
