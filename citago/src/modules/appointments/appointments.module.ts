import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { ClientsModule } from '../clients/clients.module.js';
import { StaffModule } from '../staff/staff.module.js';
import { TenantsModule } from '../tenants/tenants.module.js';
import { AgendaAccess } from './application/agenda-access.js';
import {
  AppointmentViewAssembler,
  GetAppointmentUseCase,
  GetAvailabilityUseCase,
  ListAgendaUseCase,
} from './application/appointment-queries.js';
import { AgendaReportQuery } from './application/ports/agenda-report.query.js';
import { BookAppointmentUseCase } from './application/book-appointment.use-case.js';
import { BookingRules } from './application/booking-rules.js';
import { RescheduleAppointmentUseCase } from './application/reschedule-appointment.use-case.js';
import { TransitionAppointmentUseCase } from './application/transition-appointment.use-case.js';
import { AppointmentRepository } from './domain/appointment.repository.js';
import { TypeOrmAgendaReportQuery } from './infrastructure/persistence/typeorm/typeorm-agenda-report.query.js';
import { TypeOrmAppointmentRepository } from './infrastructure/persistence/typeorm/typeorm-appointment.repository.js';
import { AppointmentsController } from './presentation/appointments.controller.js';

@Module({
  imports: [TenantsModule, CatalogModule, ClientsModule, StaffModule],
  controllers: [AppointmentsController],
  providers: [
    { provide: AppointmentRepository, useClass: TypeOrmAppointmentRepository },
    { provide: AgendaReportQuery, useClass: TypeOrmAgendaReportQuery },
    AgendaAccess,
    BookingRules,
    AppointmentViewAssembler,
    BookAppointmentUseCase,
    RescheduleAppointmentUseCase,
    TransitionAppointmentUseCase,
    GetAppointmentUseCase,
    ListAgendaUseCase,
    GetAvailabilityUseCase,
  ],
  exports: [AppointmentRepository, AgendaReportQuery],
})
export class AppointmentsModule {}
