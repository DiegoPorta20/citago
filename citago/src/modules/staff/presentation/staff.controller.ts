import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator.js';
import {
  CreateStaffMemberUseCase,
  GetStaffMemberUseCase,
  ListStaffMembersUseCase,
  ReplaceStaffScheduleUseCase,
  SetStaffMemberStatusUseCase,
  UpdateStaffMemberUseCase,
} from '../application/staff-member.use-cases.js';
import {
  AddStaffTimeOffUseCase,
  ListStaffTimeOffUseCase,
  RemoveStaffTimeOffUseCase,
} from '../application/staff-time-off.use-cases.js';
import { StaffMemberStatus } from '../domain/staff-member-status.js';
import {
  CreateStaffMemberRequestDto,
  CreateTimeOffRequestDto,
  ListTimeOffQueryDto,
  ReplaceScheduleRequestDto,
  StaffMemberResponseDto,
  TimeOffResponseDto,
  UpdateStaffMemberRequestDto,
} from './staff.dto.js';

/**
 * The people who perform the services, their weekly schedule and their time off.
 *
 * Every member may read it (the barber needs to see the team's week); only
 * OWNER and ADMIN change it (see docs/permissions.md). Staff members are never
 * deleted: they are deactivated and keep their history.
 */
@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(
    private readonly createStaffMember: CreateStaffMemberUseCase,
    private readonly updateStaffMember: UpdateStaffMemberUseCase,
    private readonly setStaffMemberStatus: SetStaffMemberStatusUseCase,
    private readonly replaceSchedule: ReplaceStaffScheduleUseCase,
    private readonly getStaffMember: GetStaffMemberUseCase,
    private readonly listStaffMembers: ListStaffMembersUseCase,
    private readonly addTimeOff: AddStaffTimeOffUseCase,
    private readonly removeTimeOff: RemoveStaffTimeOffUseCase,
    private readonly listTimeOff: ListStaffTimeOffUseCase,
  ) {}

  @Post()
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({ summary: 'Add a staff member' })
  @ApiCreatedResponse({ type: StaffMemberResponseDto })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateStaffMemberRequestDto,
  ): Promise<StaffMemberResponseDto> {
    return StaffMemberResponseDto.fromDomain(
      await this.createStaffMember.execute(auth, body),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List staff members with their weekly schedule' })
  @ApiOkResponse({ type: StaffMemberResponseDto, isArray: true })
  async list(
    @CurrentAuth() auth: AuthContext,
  ): Promise<StaffMemberResponseDto[]> {
    const members = await this.listStaffMembers.execute(auth);

    return members.map((member) => StaffMemberResponseDto.fromDomain(member));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one staff member' })
  @ApiOkResponse({ type: StaffMemberResponseDto })
  async getOne(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffMemberResponseDto> {
    return StaffMemberResponseDto.fromDomain(
      await this.getStaffMember.execute(auth, id),
    );
  }

  @Patch(':id')
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Rename a staff member or link/unlink their account',
  })
  @ApiOkResponse({ type: StaffMemberResponseDto })
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStaffMemberRequestDto,
  ): Promise<StaffMemberResponseDto> {
    return StaffMemberResponseDto.fromDomain(
      await this.updateStaffMember.execute(auth, {
        staffMemberId: id,
        displayName: body.displayName,
        userId: body.userId,
      }),
    );
  }

  @Put(':id/schedule')
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Replace the weekly schedule',
    description:
      'Sends the whole week. Existing appointments are not affected; the schedule applies to new bookings.',
  })
  @ApiOkResponse({ type: StaffMemberResponseDto })
  async setSchedule(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplaceScheduleRequestDto,
  ): Promise<StaffMemberResponseDto> {
    return StaffMemberResponseDto.fromDomain(
      await this.replaceSchedule.execute(auth, {
        staffMemberId: id,
        ranges: body.ranges,
      }),
    );
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({ summary: 'Reactivate a staff member (idempotent)' })
  @ApiOkResponse({ type: StaffMemberResponseDto })
  async activate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffMemberResponseDto> {
    return StaffMemberResponseDto.fromDomain(
      await this.setStaffMemberStatus.execute(auth, {
        staffMemberId: id,
        status: StaffMemberStatus.Active,
      }),
    );
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Deactivate a staff member (idempotent)',
    description: 'They keep their history but take no new bookings.',
  })
  @ApiOkResponse({ type: StaffMemberResponseDto })
  async deactivate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffMemberResponseDto> {
    return StaffMemberResponseDto.fromDomain(
      await this.setStaffMemberStatus.execute(auth, {
        staffMemberId: id,
        status: StaffMemberStatus.Inactive,
      }),
    );
  }

  @Get(':id/time-off')
  @ApiOperation({ summary: 'List time off overlapping a range' })
  @ApiOkResponse({ type: TimeOffResponseDto, isArray: true })
  async timeOff(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListTimeOffQueryDto,
  ): Promise<TimeOffResponseDto[]> {
    const items = await this.listTimeOff.execute(auth, {
      staffMemberId: id,
      from: new Date(query.from),
      to: new Date(query.to),
    });

    return items.map((item) => TimeOffResponseDto.fromDomain(item));
  }

  @Post(':id/time-off')
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Block a period (holidays, a day off)',
    description:
      'Blocks new bookings only. Appointments already inside the period are left for the business to reschedule with each client.',
  })
  @ApiCreatedResponse({ type: TimeOffResponseDto })
  async createTimeOff(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateTimeOffRequestDto,
  ): Promise<TimeOffResponseDto> {
    return TimeOffResponseDto.fromDomain(
      await this.addTimeOff.execute(auth, {
        staffMemberId: id,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        reason: body.reason,
      }),
    );
  }

  @Delete(':id/time-off/:timeOffId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({ summary: 'Remove a time off' })
  @ApiNoContentResponse()
  async deleteTimeOff(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('timeOffId', ParseUUIDPipe) timeOffId: string,
  ): Promise<void> {
    await this.removeTimeOff.execute(auth, { staffMemberId: id, timeOffId });
  }
}
