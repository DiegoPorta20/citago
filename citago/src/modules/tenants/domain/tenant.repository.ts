import type { WeeklySchedule } from '../../../shared/domain/weekly-schedule.js';
import type { Tenant } from './tenant.entity.js';

/**
 * Persistence contract for tenants, owned by this module.
 *
 * A tenant is the root of the tenancy tree, so these lookups are by id or
 * slug rather than tenant-scoped. Other modules reach tenants through this
 * contract only — never through its table or its ORM entity.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class TenantRepository {
  abstract findById(id: string): Promise<Tenant | null>;

  abstract existsBySlug(slug: string): Promise<boolean>;

  /**
   * The opening hours of the business, in its own wall clock (rule TZ-3).
   *
   * Part of the tenant, not an aggregate of its own: a business without hours
   * is a business that has not filled them in, so this answers with an empty
   * week rather than nothing.
   */
  abstract findHours(tenantId: string): Promise<WeeklySchedule>;

  /** Replaces the whole week: the hours are edited as one thing. */
  abstract replaceHours(tenantId: string, hours: WeeklySchedule): Promise<void>;

  abstract save(tenant: Tenant): Promise<void>;
}
