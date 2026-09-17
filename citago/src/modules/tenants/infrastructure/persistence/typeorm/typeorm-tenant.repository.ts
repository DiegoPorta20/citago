import { Injectable } from '@nestjs/common';

import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import type { Tenant } from '../../../domain/tenant.entity.js';
import { TenantRepository } from '../../../domain/tenant.repository.js';
import { TenantOrmEntity } from './entities/tenant.orm-entity.js';
import { TenantMapper } from './tenant.mapper.js';

@Injectable()
export class TypeOrmTenantRepository extends TenantRepository {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get repository() {
    // Resolved per call so writes join the current transaction, if any.
    return this.context.manager.getRepository(TenantOrmEntity);
  }

  async findById(id: string): Promise<Tenant | null> {
    const row = await this.repository.findOneBy({ id });

    return row ? TenantMapper.toDomain(row) : null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return this.repository.existsBy({ slug });
  }

  async save(tenant: Tenant): Promise<void> {
    await this.repository.save(TenantMapper.toPersistence(tenant));
  }
}
