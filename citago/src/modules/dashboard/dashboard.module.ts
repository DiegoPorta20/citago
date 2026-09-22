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

/**
 * The numbers of the business.
 *
 * The one module with **no domain**: it owns no entity, no table and no rule.
 * It reads what the other modules already guarantee, through their report
 * ports, and puts it on one screen. If it ever grows a rule of its own, that
 * rule belongs to whoever owns the data, not here.
 *
 * Nothing depends on it, so it sits at the edge of the graph and can be removed
 * without touching anything else.
 */
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
