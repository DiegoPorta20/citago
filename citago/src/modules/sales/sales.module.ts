import { Module } from '@nestjs/common';

import { AppointmentsModule } from '../appointments/appointments.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ClientsModule } from '../clients/clients.module.js';
import { StaffModule } from '../staff/staff.module.js';
import { TenantsModule } from '../tenants/tenants.module.js';
import { SalesReportQuery } from './application/ports/sales-report.query.js';
import { RegisterSaleUseCase } from './application/register-sale.use-case.js';
import {
  GetSaleUseCase,
  ListSalesUseCase,
  SaleViewAssembler,
} from './application/sale-queries.js';
import { SalesAccess } from './application/sales-access.js';
import { TransitionSaleUseCase } from './application/transition-sale.use-case.js';
import { SaleRepository } from './domain/sale.repository.js';
import { TypeOrmSaleRepository } from './infrastructure/persistence/typeorm/typeorm-sale.repository.js';
import { TypeOrmSalesReportQuery } from './infrastructure/persistence/typeorm/typeorm-sales-report.query.js';
import { SalesController } from './presentation/sales.controller.js';

/**
 * The till: what the business charged, and for what.
 *
 * Depends on appointments (what is being charged), catalogue (prices), clients,
 * staff and tenants (the currency), always through their exported contracts.
 * The dashboard reads it through `SalesReportQuery`, a separate port that only
 * returns numbers: a report never loads a sale it is not going to change.
 */
@Module({
  imports: [
    TenantsModule,
    CatalogModule,
    ClientsModule,
    StaffModule,
    AppointmentsModule,
  ],
  controllers: [SalesController],
  providers: [
    { provide: SaleRepository, useClass: TypeOrmSaleRepository },
    { provide: SalesReportQuery, useClass: TypeOrmSalesReportQuery },
    SalesAccess,
    SaleViewAssembler,
    RegisterSaleUseCase,
    TransitionSaleUseCase,
    GetSaleUseCase,
    ListSalesUseCase,
  ],
  exports: [SaleRepository, SalesReportQuery],
})
export class SalesModule {}
