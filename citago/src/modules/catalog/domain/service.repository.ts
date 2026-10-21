import type { Page, PageRequest } from '../../../shared/domain/pagination.js';
import type { Service } from './service.entity.js';
import type { ServiceStatus } from './service-status.js';

export interface ServiceListFilters {
  readonly status?: ServiceStatus;
  readonly query?: string;
}

export abstract class ServiceRepository {
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Service | null>;

  abstract findManyByIdsForTenant(
    ids: readonly string[],
    tenantId: string,
  ): Promise<Service[]>;

  abstract list(
    tenantId: string,
    filters: ServiceListFilters,
    page: PageRequest,
  ): Promise<Page<Service>>;

  abstract existsActiveWithName(
    tenantId: string,
    name: string,
    excludeServiceId?: string,
  ): Promise<boolean>;

  abstract save(service: Service): Promise<void>;
}
