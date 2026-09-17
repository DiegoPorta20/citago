import { Module } from '@nestjs/common';

import { CreateServiceUseCase } from './application/create-service/create-service.use-case.js';
import { GetServiceUseCase } from './application/get-service/get-service.use-case.js';
import { ListServicesUseCase } from './application/list-services/list-services.use-case.js';
import { SetServiceStatusUseCase } from './application/set-service-status/set-service-status.use-case.js';
import { UpdateServiceUseCase } from './application/update-service/update-service.use-case.js';
import { ServiceRepository } from './domain/service.repository.js';
import { TypeOrmServiceRepository } from './infrastructure/persistence/typeorm/typeorm-service.repository.js';
import { ServicesController } from './presentation/services.controller.js';

/**
 * The catalogue of what the business sells and schedules.
 *
 * Named `catalog` rather than `services`: in NestJS "service" already means a
 * provider, and `ServicesService` would be a confusing name for something that
 * models a haircut.
 *
 * Exports the repository contract so `appointments` can validate a service
 * without touching this module's table.
 */
@Module({
  controllers: [ServicesController],
  providers: [
    { provide: ServiceRepository, useClass: TypeOrmServiceRepository },
    CreateServiceUseCase,
    UpdateServiceUseCase,
    SetServiceStatusUseCase,
    ListServicesUseCase,
    GetServiceUseCase,
  ],
  exports: [ServiceRepository],
})
export class CatalogModule {}
