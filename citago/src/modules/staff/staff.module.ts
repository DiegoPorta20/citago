import { Module } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module.js';
import {
  CreateStaffMemberUseCase,
  GetStaffMemberUseCase,
  ListStaffMembersUseCase,
  ReplaceStaffScheduleUseCase,
  SetStaffMemberStatusUseCase,
  UpdateStaffMemberUseCase,
} from './application/staff-member.use-cases.js';
import {
  AddStaffTimeOffUseCase,
  ListStaffTimeOffUseCase,
  RemoveStaffTimeOffUseCase,
} from './application/staff-time-off.use-cases.js';
import { StaffAgendaLock } from './application/ports/staff-agenda-lock.port.js';
import { StaffScope } from './application/staff-scope.js';
import { StaffUserLinkValidator } from './application/staff-user-link.validator.js';
import { StaffRepository } from './domain/staff.repository.js';
import { TypeOrmStaffAgendaLock } from './infrastructure/persistence/typeorm/typeorm-staff-agenda-lock.js';
import { TypeOrmStaffRepository } from './infrastructure/persistence/typeorm/typeorm-staff.repository.js';
import { StaffController } from './presentation/staff.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [StaffController],
  providers: [
    { provide: StaffRepository, useClass: TypeOrmStaffRepository },
    { provide: StaffAgendaLock, useClass: TypeOrmStaffAgendaLock },
    StaffScope,
    StaffUserLinkValidator,
    CreateStaffMemberUseCase,
    UpdateStaffMemberUseCase,
    SetStaffMemberStatusUseCase,
    ReplaceStaffScheduleUseCase,
    GetStaffMemberUseCase,
    ListStaffMembersUseCase,
    AddStaffTimeOffUseCase,
    RemoveStaffTimeOffUseCase,
    ListStaffTimeOffUseCase,
  ],
  exports: [StaffRepository, StaffAgendaLock, StaffScope],
})
export class StaffModule {}
