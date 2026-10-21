import type { WeeklySchedule } from '../../../shared/domain/weekly-schedule.js';
import type { Tenant } from './tenant.entity.js';

export abstract class TenantRepository {
  abstract findById(id: string): Promise<Tenant | null>;

  abstract existsBySlug(slug: string): Promise<boolean>;

  abstract findHours(tenantId: string): Promise<WeeklySchedule>;

  abstract replaceHours(tenantId: string, hours: WeeklySchedule): Promise<void>;

  abstract save(tenant: Tenant): Promise<void>;
}
