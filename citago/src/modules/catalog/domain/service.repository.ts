import type { Page, PageRequest } from '../../../shared/domain/pagination.js';
import type { Service } from './service.entity.js';
import type { ServiceStatus } from './service-status.js';

export interface ServiceListFilters {
  readonly status?: ServiceStatus;
  /** Free-text search over the name. */
  readonly query?: string;
}

/**
 * Persistence contract for services.
 *
 * **Every method takes `tenantId`.** There is deliberately no `findById(id)`:
 * a lookup without a tenant is exactly the hole an IDOR needs
 * (see docs/adr/0004-tenant-isolation.md).
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class ServiceRepository {
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Service | null>;

  abstract list(
    tenantId: string,
    filters: ServiceListFilters,
    page: PageRequest,
  ): Promise<Page<Service>>;

  /**
   * Supports the "no two active services with the same name" check.
   * Case-insensitive, and able to ignore the service being edited.
   */
  abstract existsActiveWithName(
    tenantId: string,
    name: string,
    excludeServiceId?: string,
  ): Promise<boolean>;

  abstract save(service: Service): Promise<void>;
}
