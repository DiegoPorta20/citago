import { Module } from '@nestjs/common';

import { TenantsModule } from '../tenants/tenants.module.js';
import { ClientPhoneNormalizer } from './application/client-phone-normalizer.js';
import { CreateClientUseCase } from './application/create-client/create-client.use-case.js';
import { DeleteClientUseCase } from './application/delete-client/delete-client.use-case.js';
import { GetClientUseCase } from './application/get-client/get-client.use-case.js';
import { ListClientsUseCase } from './application/list-clients/list-clients.use-case.js';
import { RestoreClientUseCase } from './application/restore-client/restore-client.use-case.js';
import { UpdateClientUseCase } from './application/update-client/update-client.use-case.js';
import { ClientRepository } from './domain/client.repository.js';
import { TypeOrmClientRepository } from './infrastructure/persistence/typeorm/typeorm-client.repository.js';
import { ClientsController } from './presentation/clients.controller.js';

@Module({
  imports: [TenantsModule],
  controllers: [ClientsController],
  providers: [
    { provide: ClientRepository, useClass: TypeOrmClientRepository },
    ClientPhoneNormalizer,
    CreateClientUseCase,
    UpdateClientUseCase,
    GetClientUseCase,
    ListClientsUseCase,
    DeleteClientUseCase,
    RestoreClientUseCase,
  ],
  exports: [ClientRepository, ClientPhoneNormalizer],
})
export class ClientsModule {}
