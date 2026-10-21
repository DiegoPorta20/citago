import { Module } from '@nestjs/common';

import { AppointmentsModule } from '../appointments/appointments.module.js';
import { ClientsModule } from '../clients/clients.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { StaffModule } from '../staff/staff.module.js';
import { TenantsModule } from '../tenants/tenants.module.js';
import { DashboardPeriod } from './application/dashboard-period.js';
import { GetBusinessDashboardUseCase } from './application/get-business-dashboard.use-case.js';
import { GetOwnDashboardUseCase } from './application/get-own-dashboard.use-case.js';
import { DashboardController } from './presentation/dashboard.controller.js';

@Module({
  imports: [
    TenantsModule,
    StaffModule,
    ClientsModule,
    AppointmentsModule,
    SalesModule,
  ],
  controllers: [DashboardController],
  providers: [
    DashboardPeriod,
    GetBusinessDashboardUseCase,
    GetOwnDashboardUseCase,
  ],
})
export class DashboardModule {}
