import { Module } from '@nestjs/common';

import { CreateServiceUseCase } from './application/create-service/create-service.use-case.js';
import { GetServiceUseCase } from './application/get-service/get-service.use-case.js';
import { ListServicesUseCase } from './application/list-services/list-services.use-case.js';
import { SetServiceStatusUseCase } from './application/set-service-status/set-service-status.use-case.js';
import { UpdateServiceUseCase } from './application/update-service/update-service.use-case.js';
import { ServiceRepository } from './domain/service.repository.js';
import { TypeOrmServiceRepository } from './infrastructure/persistence/typeorm/typeorm-service.repository.js';
import { ServicesController } from './presentation/services.controller.js';

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
