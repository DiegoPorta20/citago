import {
  buildPage,
  offsetOf,
  type Page,
  type PageRequest,
} from '../../../src/shared/domain/pagination.js';
import type { Service } from '../../../src/modules/catalog/domain/service.entity.js';
import {
  ServiceRepository,
  type ServiceListFilters,
} from '../../../src/modules/catalog/domain/service.repository.js';
import { ServiceStatus } from '../../../src/modules/catalog/domain/service-status.js';

/**
 * In-memory service repository that honours tenant scoping and the
 * case-insensitive name rule, so a use case misusing it fails here rather than
 * in production.
 */
export class InMemoryServiceRepository extends ServiceRepository {
  readonly services = new Map<string, Service>();

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Service | null> {
    const service = this.services.get(id);

    return service && service.tenantId === tenantId ? service : null;
  }

  async findManyByIdsForTenant(
    ids: readonly string[],
    tenantId: string,
  ): Promise<Service[]> {
    return [...this.services.values()].filter(
      (service) => service.tenantId === tenantId && ids.includes(service.id),
    );
  }

  async list(
    tenantId: string,
    filters: ServiceListFilters,
    page: PageRequest,
  ): Promise<Page<Service>> {
    const matches = [...this.services.values()]
      .filter((service) => service.tenantId === tenantId)
      .filter((service) => !filters.status || service.status === filters.status)
      .filter(
        (service) =>
          !filters.query ||
          service.name.toLowerCase().startsWith(filters.query.toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const offset = offsetOf(page);

    return buildPage(
      matches.slice(offset, offset + page.limit),
      matches.length,
      page,
    );
  }

  async existsActiveWithName(
    tenantId: string,
    name: string,
    excludeServiceId?: string,
  ): Promise<boolean> {
    return [...this.services.values()].some(
      (service) =>
        service.tenantId === tenantId &&
        service.status === ServiceStatus.Active &&
        service.id !== excludeServiceId &&
        service.name.toLowerCase() === name.toLowerCase(),
    );
  }

  async save(service: Service): Promise<void> {
    this.services.set(service.id, service);
  }
}
