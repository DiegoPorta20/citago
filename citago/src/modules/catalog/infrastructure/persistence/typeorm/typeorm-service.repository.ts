import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';

import {
  buildPage,
  offsetOf,
  type Page,
  type PageRequest,
} from '../../../../../shared/domain/pagination.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { Service } from '../../../domain/service.entity.js';
import {
  ServiceRepository,
  type ServiceListFilters,
} from '../../../domain/service.repository.js';
import { ServiceStatus } from '../../../domain/service-status.js';
import { ServiceOrmEntity } from './entities/service.orm-entity.js';

@Injectable()
export class TypeOrmServiceRepository extends ServiceRepository {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get repository() {
    // Resolved per call so writes join the current transaction, if any.
    return this.context.manager.getRepository(ServiceOrmEntity);
  }

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Service | null> {
    const row = await this.repository.findOneBy({ id, tenantId });

    return row ? this.toDomain(row) : null;
  }

  async findManyByIdsForTenant(
    ids: readonly string[],
    tenantId: string,
  ): Promise<Service[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.repository.findBy({ id: In([...ids]), tenantId });

    return rows.map((row) => this.toDomain(row));
  }

  async list(
    tenantId: string,
    filters: ServiceListFilters,
    page: PageRequest,
  ): Promise<Page<Service>> {
    const query = this.repository
      .createQueryBuilder('service')
      // Every listing starts from the tenant, and the alias keeps it explicit.
      .where('service.tenant_id = :tenantId', { tenantId });

    if (filters.status) {
      query.andWhere('service.status = :status', { status: filters.status });
    }

    if (filters.query) {
      // Prefix match: it can use the (tenant_id, status, name) index, unlike a
      // leading wildcard. Good enough for a catalogue of a few dozen rows.
      query.andWhere('service.name LIKE :name', { name: `${filters.query}%` });
    }

    const [rows, total] = await query
      .orderBy('service.name', 'ASC')
      .skip(offsetOf(page))
      .take(page.limit)
      .getManyAndCount();

    return buildPage(
      rows.map((row) => this.toDomain(row)),
      total,
      page,
    );
  }

  async existsActiveWithName(
    tenantId: string,
    name: string,
    excludeServiceId?: string,
  ): Promise<boolean> {
    const query = this.repository
      .createQueryBuilder('service')
      .where('service.tenant_id = :tenantId', { tenantId })
      .andWhere('service.status = :status', { status: ServiceStatus.Active })
      // The column collation is utf8mb4_0900_ai_ci, so `=` already ignores
      // case and accents: "Corte" and "corte" collide, as intended.
      .andWhere('service.name = :name', { name });

    if (excludeServiceId) {
      query.andWhere('service.id <> :excludeServiceId', { excludeServiceId });
    }

    return (await query.getCount()) > 0;
  }

  async save(service: Service): Promise<void> {
    const snapshot = service.toSnapshot();
    const row = new ServiceOrmEntity();

    row.id = snapshot.id;
    row.tenantId = snapshot.tenantId;
    row.name = snapshot.name;
    row.description = snapshot.description;
    row.durationMinutes = snapshot.durationMinutes;
    row.price = snapshot.price;
    row.status = snapshot.status;
    row.createdAt = snapshot.createdAt;
    row.updatedAt = snapshot.updatedAt;

    await this.repository.save(row);
  }

  private toDomain(row: ServiceOrmEntity): Service {
    return Service.restore({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description,
      durationMinutes: Number(row.durationMinutes),
      price: row.price,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
