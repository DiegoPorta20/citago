import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { MAX_SERVICE_DURATION_MINUTES } from './create-service.request.dto.js';

/**
 * Partial update: only the fields present are applied.
 *
 * Changing the price or the duration never rewrites existing appointments —
 * each one keeps its own snapshot.
 */
export class UpdateServiceRequestDto {
  @ApiPropertyOptional({ example: 'Corte de cabello', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'Incluye lavado',
    maxLength: 500,
    description: 'An empty string clears the description.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: 45,
    minimum: 1,
    maximum: MAX_SERVICE_DURATION_MINUTES,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SERVICE_DURATION_MINUTES)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: '35.00' })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN, {
    message:
      'price must be a non-negative decimal string with at most 2 decimals, e.g. "35.00"',
  })
  price?: string;
}
