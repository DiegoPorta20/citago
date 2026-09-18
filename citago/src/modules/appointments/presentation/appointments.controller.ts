import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import type { Page } from '../../../shared/domain/pagination.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { ApiErrorDto } from '../../../shared/presentation/dto/api-error.dto.js';
import {
  AppointmentViewAssembler,
  GetAppointmentUseCase,
  GetAvailabilityUseCase,
  ListAgendaUseCase,
} from '../application/appointment-queries.js';
import { BookAppointmentUseCase } from '../application/book-appointment.use-case.js';
import { RescheduleAppointmentUseCase } from '../application/reschedule-appointment.use-case.js';
import { TransitionAppointmentUseCase } from '../application/transition-appointment.use-case.js';
import type { Appointment } from '../domain/appointment.entity.js';
import { AppointmentStatus } from '../domain/appointment-status.js';
import {
  AppointmentDetailResponseDto,
  AppointmentResponseDto,
  AvailabilityQueryDto,
  AvailabilityResponseDto,
  BookAppointmentRequestDto,
  ListAgendaQueryDto,
  RescheduleAppointmentRequestDto,
  StatusChangeResponseDto,
  TransitionRequestDto,
} from './appointments.dto.js';

/**
 * The agenda.
 *
 * No `@Roles` here on purpose: every member works with appointments. What each
 * role may touch depends on *which* appointment, so it is enforced in the use
 * cases — OWNER and ADMIN manage every agenda, STAFF only their own
 * (docs/permissions.md).
 *
 * The lifecycle has one explicit endpoint per action rather than a generic
 * "set status": the API reads like the business, and each action documents
 * its own rules.
 */
@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly bookAppointment: BookAppointmentUseCase,
    private readonly rescheduleAppointment: RescheduleAppointmentUseCase,
    private readonly transitionAppointment: TransitionAppointmentUseCase,
    private readonly getAppointment: GetAppointmentUseCase,
    private readonly listAgenda: ListAgendaUseCase,
    private readonly getAvailability: GetAvailabilityUseCase,
    private readonly assembler: AppointmentViewAssembler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Book an appointment' })
  @ApiCreatedResponse({ type: AppointmentResponseDto })
  @ApiConflictResponse({
    description: 'APPOINTMENT_OVERLAP',
    type: ApiErrorDto,
  })
  @ApiUnprocessableEntityResponse({
    description:
      'OUTSIDE_STAFF_SCHEDULE, STAFF_ON_TIME_OFF, APPOINTMENT_IN_THE_PAST, SERVICE_NOT_BOOKABLE…',
    type: ApiErrorDto,
  })
  async book(
    @CurrentAuth() auth: AuthContext,
    @Body() body: BookAppointmentRequestDto,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.bookAppointment.execute(auth, {
      clientId: body.clientId,
      serviceId: body.serviceId,
      staffMemberId: body.staffMemberId,
      startAt: new Date(body.startAt),
      notes: body.notes,
      initialStatus: body.status,
      allowOutsideSchedule: body.allowOutsideSchedule,
    });

    return this.present(auth, appointment);
  }

  @Get()
  @ApiOperation({
    summary: 'Agenda: appointments overlapping a time range',
    description: 'STAFF users only ever see their own agenda.',
  })
  @ApiOkResponse({ type: AppointmentResponseDto, isArray: true })
  async agenda(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListAgendaQueryDto,
  ): Promise<Page<AppointmentResponseDto>> {
    const page = await this.listAgenda.execute(auth, {
      page: query.page,
      limit: query.limit,
      from: new Date(query.from),
      to: new Date(query.to),
      staffMemberId: query.staffMemberId,
      clientId: query.clientId,
      status: query.status,
    });

    return {
      items: page.items.map((view) => AppointmentResponseDto.fromView(view)),
      meta: page.meta,
    };
  }

  @Get('availability')
  @ApiOperation({
    summary: 'Free start times for a service with a staff member on a date',
    description:
      'Advisory: a slot is only guaranteed when booking. Uses the working schedule, time off and existing appointments.',
  })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  async availability(
    @CurrentAuth() auth: AuthContext,
    @Query() query: AvailabilityQueryDto,
  ): Promise<AvailabilityResponseDto> {
    return AvailabilityResponseDto.fromResult(
      await this.getAvailability.execute(auth, query),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'One appointment with its status history' })
  @ApiOkResponse({ type: AppointmentDetailResponseDto })
  async detail(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentDetailResponseDto> {
    const { view, history } = await this.getAppointment.execute(auth, id);

    return {
      ...AppointmentResponseDto.fromView(view),
      history: history.map((change) =>
        StatusChangeResponseDto.fromDomain(change),
      ),
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Reschedule, reassign or edit notes',
    description:
      'Keeps the booked duration and price. Only pending or confirmed appointments can move.',
  })
  @ApiOkResponse({ type: AppointmentResponseDto })
  async reschedule(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RescheduleAppointmentRequestDto,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.rescheduleAppointment.execute(auth, {
      appointmentId: id,
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      staffMemberId: body.staffMemberId,
      notes: body.notes,
      allowOutsideSchedule: body.allowOutsideSchedule,
    });

    return this.present(auth, appointment);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  confirm(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentResponseDto> {
    return this.move(auth, id, AppointmentStatus.Confirmed);
  }

  @Post(':id/arrive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'The client is in the shop' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  arrive(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentResponseDto> {
    return this.move(auth, id, AppointmentStatus.Arrived);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Service started' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  start(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentResponseDto> {
    return this.move(auth, id, AppointmentStatus.InProgress);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Service done',
    description:
      'Allowed directly from PENDING or CONFIRMED, and after a no-show.',
  })
  @ApiOkResponse({ type: AppointmentResponseDto })
  complete(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentResponseDto> {
    return this.move(auth, id, AppointmentStatus.Completed);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel (a reason is required if already in progress)',
  })
  @ApiOkResponse({ type: AppointmentResponseDto })
  cancel(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionRequestDto,
  ): Promise<AppointmentResponseDto> {
    return this.move(auth, id, AppointmentStatus.Cancelled, body.reason);
  }

  @Post(':id/no-show')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'The client did not come (only after the start time)',
  })
  @ApiOkResponse({ type: AppointmentResponseDto })
  noShow(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentResponseDto> {
    return this.move(auth, id, AppointmentStatus.NoShow);
  }

  private async move(
    auth: AuthContext,
    id: string,
    target: AppointmentStatus,
    reason?: string,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.transitionAppointment.execute(auth, {
      appointmentId: id,
      target,
      reason,
    });

    return this.present(auth, appointment);
  }

  private async present(
    auth: AuthContext,
    appointment: Appointment,
  ): Promise<AppointmentResponseDto> {
    const [view] = await this.assembler.assemble(auth.tenantId, [appointment]);

    return AppointmentResponseDto.fromView(view);
  }
}
