import { Module } from '@nestjs/common';

import {
  GetBusinessUseCase,
  ReplaceBusinessHoursUseCase,
  UpdateBusinessUseCase,
} from './application/business.use-cases.js';
import { TenantRepository } from './domain/tenant.repository.js';
import { TypeOrmTenantRepository } from './infrastructure/persistence/typeorm/typeorm-tenant.repository.js';
import { BusinessController } from './presentation/business.controller.js';

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
