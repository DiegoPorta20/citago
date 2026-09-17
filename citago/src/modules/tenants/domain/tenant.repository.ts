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

  abstract save(tenant: Tenant): Promise<void>;
}
