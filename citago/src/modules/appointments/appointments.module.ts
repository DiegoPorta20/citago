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
import { BookAppointmentUseCase } from './application/book-appointment.use-case.js';
import { BookingRules } from './application/booking-rules.js';
import { RescheduleAppointmentUseCase } from './application/reschedule-appointment.use-case.js';
import { TransitionAppointmentUseCase } from './application/transition-appointment.use-case.js';
import { AppointmentRepository } from './domain/appointment.repository.js';
import { TypeOrmAppointmentRepository } from './infrastructure/persistence/typeorm/typeorm-appointment.repository.js';
import { AppointmentsController } from './presentation/appointments.controller.js';

/**
 * The agenda: booking, rescheduling and the appointment lifecycle.
 *
 * Depends on the modules it books against — catalog (service), clients
 * (client), staff (barber, schedule, agenda lock) and tenants (time zone) —
 * always through their exported contracts, never their tables. Nothing depends
 * back on it, so there is no cycle.
 *
 * Exports the repository for the modules that come next (sales, dashboard).
 */
@Module({
  imports: [TenantsModule, CatalogModule, ClientsModule, StaffModule],
  controllers: [AppointmentsController],
  providers: [
    { provide: AppointmentRepository, useClass: TypeOrmAppointmentRepository },
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
  exports: [AppointmentRepository],
})
export class AppointmentsModule {}
