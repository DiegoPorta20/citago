import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { MONEY_PATTERN } from '../../../../shared/presentation/dto/money-pattern.js';

export const MAX_SERVICE_DURATION_MINUTES = 720;

export class CreateServiceRequestDto {
  @ApiProperty({ example: 'Corte de cabello', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Incluye lavado y peinado', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: 30,
    minimum: 1,
    maximum: MAX_SERVICE_DURATION_MINUTES,
    description: 'Drives when an appointment ends, so it decides overlaps.',
  })
  @IsInt()
  @Min(1)
  @Max(MAX_SERVICE_DURATION_MINUTES)
  durationMinutes: number;

  @ApiProperty({
    example: '25.00',
    description:
      'Decimal **string** in the tenant currency. Sent as a string so no amount ever passes through floating point.',
  })
  @IsString()
  @Matches(MONEY_PATTERN, {
    message:
      'price must be a non-negative decimal string with at most 2 decimals, e.g. "25.00"',
  })
  price: string;
}
