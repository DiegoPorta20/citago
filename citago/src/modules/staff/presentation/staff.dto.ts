import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import type { StaffMember } from '../domain/staff-member.entity.js';
import { StaffMemberStatus } from '../domain/staff-member-status.js';
import type { StaffTimeOff } from '../domain/staff-time-off.entity.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateStaffMemberRequestDto {
  @ApiProperty({ example: 'Carlos', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Account of this barber, if they use the app. Must be a member of this business.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class UpdateStaffMemberRequestDto {
  @ApiPropertyOptional({ example: 'Carlos R.', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'null unlinks the account.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateStaffMemberRequestDto) => dto.userId !== null)
  @IsUUID()
  userId?: string | null;
}

export class ScheduleRangeDto {
  @ApiProperty({
    minimum: 1,
    maximum: 7,
    example: 1,
    description: '1 = Monday … 7 = Sunday',
  })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday: number;

  @ApiProperty({ example: '09:00', description: 'Business wall-clock time.' })
  @Matches(TIME_PATTERN, { message: 'startsAt must be HH:mm' })
  startsAt: string;

  @ApiProperty({ example: '13:00' })
  @Matches(TIME_PATTERN, { message: 'endsAt must be HH:mm' })
  endsAt: string;
}

export class ReplaceScheduleRequestDto {
  @ApiProperty({
    type: ScheduleRangeDto,
    isArray: true,
    description:
      'The whole week. Several ranges on one day model a break; a day with none is a day off.',
  })
  @IsArray()
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => ScheduleRangeDto)
  ranges: ScheduleRangeDto[];
}

export class CreateTimeOffRequestDto {
  @ApiProperty({ example: '2026-10-01T05:00:00.000Z' })
  @IsDateString({ strict: true })
  startsAt: string;

  @ApiProperty({ example: '2026-10-04T05:00:00.000Z' })
  @IsDateString({ strict: true })
  endsAt: string;

  @ApiPropertyOptional({ example: 'Vacaciones', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ListTimeOffQueryDto {
  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  @IsDateString({ strict: true })
  from: string;

  @ApiProperty({ example: '2026-11-01T00:00:00.000Z' })
  @IsDateString({ strict: true })
  to: string;
}

export class ScheduleRangeResponseDto {
  @ApiProperty({ example: 1 })
  weekday: number;

  @ApiProperty({ example: '09:00' })
  startsAt: string;

  @ApiProperty({ example: '13:00' })
  endsAt: string;
}

export class StaffMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Carlos' })
  displayName: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  userId: string | null;

  @ApiProperty({ enum: StaffMemberStatus })
  status: StaffMemberStatus;

  @ApiProperty({ type: ScheduleRangeResponseDto, isArray: true })
  schedule: ScheduleRangeResponseDto[];

  static fromDomain(member: StaffMember): StaffMemberResponseDto {
    return {
      id: member.id,
      displayName: member.displayName,
      userId: member.userId,
      status: member.status,
      schedule: member.schedule.all().map((range) => ({
        weekday: range.weekday,
        startsAt: range.startsAt.toString(),
        endsAt: range.endsAt.toString(),
      })),
    };
  }
}

export class TimeOffResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  staffMemberId: string;

  @ApiProperty()
  startsAt: string;

  @ApiProperty()
  endsAt: string;

  @ApiPropertyOptional({ nullable: true })
  reason: string | null;

  static fromDomain(timeOff: StaffTimeOff): TimeOffResponseDto {
    return {
      id: timeOff.id,
      staffMemberId: timeOff.staffMemberId,
      startsAt: timeOff.range.start.toISOString(),
      endsAt: timeOff.range.end.toISOString(),
      reason: timeOff.reason,
    };
  }
}
