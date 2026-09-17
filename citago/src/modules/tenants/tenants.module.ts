import { Module } from '@nestjs/common';

import { TenantRepository } from './domain/tenant.repository.js';
import { TypeOrmTenantRepository } from './infrastructure/persistence/typeorm/typeorm-tenant.repository.js';

/**
 * Owns the tenant (the business) and its configuration.
 *
 * Exports only the domain contract: another module may create or read a tenant
 * through `TenantRepository`, never through its table or ORM entity.
 */
@Module({
  providers: [{ provide: TenantRepository, useClass: TypeOrmTenantRepository }],
  exports: [TenantRepository],
})
export class TenantsModule {}
