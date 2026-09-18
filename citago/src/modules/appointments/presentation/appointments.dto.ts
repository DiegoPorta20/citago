import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { PaginationQueryDto } from '../../../shared/presentation/dto/pagination-query.dto.js';
import type {
  AppointmentView,
  AvailabilityResult,
} from '../application/appointment-queries.js';
import type { AppointmentStatusChange } from '../domain/appointment.entity.js';
import { AppointmentSource } from '../domain/appointment-source.js';
import { AppointmentStatus } from '../domain/appointment-status.js';

export class BookAppointmentRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serviceId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  staffMemberId: string;

  @ApiProperty({
    example: '2026-09-17T15:00:00.000Z',
    description:
      'UTC instant. The end is computed from the service duration, which is frozen into the appointment together with its price.',
  })
  @IsDateString({ strict: true })
  startAt: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    enum: [AppointmentStatus.Pending, AppointmentStatus.Confirmed],
    default: AppointmentStatus.Pending,
  })
  @IsOptional()
  @IsIn([AppointmentStatus.Pending, AppointmentStatus.Confirmed])
  status?: AppointmentStatus.Pending | AppointmentStatus.Confirmed;

  @ApiPropertyOptional({
    default: false,
    description:
      'OWNER/ADMIN only: book outside working hours, during time off, or in the past. Overlaps are never allowed.',
  })
  @IsOptional()
  @IsBoolean()
  allowOutsideSchedule?: boolean;
}

export class RescheduleAppointmentRequestDto {
  @ApiPropertyOptional({ example: '2026-09-18T15:00:00.000Z' })
  @IsOptional()
  @IsDateString({ strict: true })
  startAt?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  staffMemberId?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    nullable: true,
    description: 'Empty string or null clears the notes.',
  })
  @IsOptional()
  @ValidateIf((dto: RescheduleAppointmentRequestDto) => dto.notes !== null)
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowOutsideSchedule?: boolean;
}

export class TransitionRequestDto {
  @ApiPropertyOptional({
    maxLength: 255,
    description: 'Required to cancel an appointment already in progress.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ListAgendaQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: '2026-09-17T05:00:00.000Z' })
  @IsDateString({ strict: true })
  from: string;

  @ApiProperty({
    example: '2026-09-18T05:00:00.000Z',
    description: 'At most 62 days after `from`.',
  })
  @IsDateString({ strict: true })
  to: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  staffMemberId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}

export class AvailabilityQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  staffMemberId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serviceId: string;

  @ApiProperty({
    example: '2026-09-17',
    description: 'Local date in the business time zone.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date: string;
}

class NamedRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

class ClientRefDto extends NamedRefDto {
  @ApiPropertyOptional({ nullable: true, example: '+51999999999' })
  phone: string | null;
}

export class AppointmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: AppointmentStatus })
  status: AppointmentStatus;

  @ApiProperty()
  startAt: string;

  @ApiProperty()
  endAt: string;

  @ApiProperty({ example: '25.00', description: 'Price agreed at booking.' })
  price: string;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty({ enum: AppointmentSource })
  source: AppointmentSource;

  @ApiProperty({ type: ClientRefDto, nullable: true })
  client: ClientRefDto | null;

  @ApiProperty({ type: NamedRefDto, nullable: true })
  service: NamedRefDto | null;

  @ApiProperty({ type: NamedRefDto, nullable: true })
  staffMember: NamedRefDto | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  cancelledAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  cancellationReason: string | null;

  static fromView(view: AppointmentView): AppointmentResponseDto {
    const snapshot = view.appointment.toSnapshot();

    return {
      id: snapshot.id,
      status: snapshot.status,
      startAt: snapshot.startAt.toISOString(),
      endAt: snapshot.endAt.toISOString(),
      price: snapshot.price,
      notes: snapshot.notes,
      source: snapshot.source,
      client: view.client
        ? {
            id: view.client.id,
            name: view.client.name,
            phone: view.client.phone,
          }
        : null,
      service: view.service
        ? { id: view.service.id, name: view.service.name }
        : null,
      staffMember: view.staffMember
        ? { id: view.staffMember.id, name: view.staffMember.displayName }
        : null,
      completedAt: snapshot.completedAt?.toISOString() ?? null,
      cancelledAt: snapshot.cancelledAt?.toISOString() ?? null,
      cancellationReason: snapshot.cancellationReason,
    };
  }
}

export class StatusChangeResponseDto {
  @ApiPropertyOptional({ enum: AppointmentStatus, nullable: true })
  fromStatus: AppointmentStatus | null;

  @ApiProperty({ enum: AppointmentStatus })
  toStatus: AppointmentStatus;

  @ApiPropertyOptional({ nullable: true })
  reason: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  changedByUserId: string | null;

  @ApiProperty()
  changedAt: string;

  static fromDomain(change: AppointmentStatusChange): StatusChangeResponseDto {
    return {
      fromStatus: change.fromStatus,
      toStatus: change.toStatus,
      reason: change.reason,
      changedByUserId: change.changedByUserId,
      changedAt: change.changedAt.toISOString(),
    };
  }
}

export class AppointmentDetailResponseDto extends AppointmentResponseDto {
  @ApiProperty({ type: StatusChangeResponseDto, isArray: true })
  history: StatusChangeResponseDto[];
}

class SlotDto {
  @ApiProperty()
  startAt: string;

  @ApiProperty()
  endAt: string;

  @ApiProperty({ example: '09:30', description: 'Business wall-clock time.' })
  localTime: string;
}

export class AvailabilityResponseDto {
  @ApiProperty({ example: '2026-09-17' })
  date: string;

  @ApiProperty({ example: 'America/Lima' })
  timezone: string;

  @ApiProperty({ example: 30 })
  durationMinutes: number;

  @ApiProperty({ type: SlotDto, isArray: true })
  slots: SlotDto[];

  static fromResult(result: AvailabilityResult): AvailabilityResponseDto {
    return {
      date: result.date,
      timezone: result.timezone,
      durationMinutes: result.durationMinutes,
      slots: result.slots.map((slot) => ({
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        localTime: slot.localTime,
      })),
    };
  }
}
