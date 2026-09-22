import { Module } from '@nestjs/common';

import {
  GetBusinessUseCase,
  ReplaceBusinessHoursUseCase,
  UpdateBusinessUseCase,
} from './application/business.use-cases.js';
import { TenantRepository } from './domain/tenant.repository.js';
import { TypeOrmTenantRepository } from './infrastructure/persistence/typeorm/typeorm-tenant.repository.js';
import { BusinessController } from './presentation/business.controller.js';

/**
 * Owns the tenant (the business), its configuration and its opening hours.
 *
 * Exports only the domain contract: another module may create or read a tenant
 * through `TenantRepository`, never through its table or ORM entity.
 */
@Module({
  controllers: [BusinessController],
  providers: [
    { provide: TenantRepository, useClass: TypeOrmTenantRepository },
    GetBusinessUseCase,
    UpdateBusinessUseCase,
    ReplaceBusinessHoursUseCase,
  ],
  exports: [TenantRepository],
})
export class TenantsModule {}
