import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Matches, Max, Min } from 'class-validator';

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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
