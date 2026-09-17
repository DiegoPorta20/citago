import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { BusinessType } from '../../../tenants/domain/business-type.js';

/** Long enough to resist guessing, with no composition rules (NIST guidance). */
export const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;

export class RegisterBusinessRequestDto {
  @ApiProperty({ example: 'Barbería Los Ángeles', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  businessName: string;

  @ApiPropertyOptional({
    enum: BusinessType,
    default: BusinessType.Barbershop,
    description: 'Vertical of the business. Data only: it drives no rules.',
  })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiProperty({
    example: 'PE',
    description: 'ISO 3166-1 alpha-2 country code.',
  })
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'country must be an ISO 3166-1 alpha-2 code',
  })
  country: string;

  @ApiProperty({ example: 'PEN', description: 'ISO 4217 currency code.' })
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be an ISO 4217 code' })
  currency: string;

  @ApiProperty({
    example: 'America/Lima',
    description:
      'IANA time zone. The agenda and daily totals are computed in it.',
  })
  @IsString()
  @MaxLength(64)
  timezone: string;

  @ApiProperty({ example: 'Carlos Ramírez', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  ownerName: string;

  @ApiProperty({ example: 'carlos@barberia.pe' })
  @IsEmail()
  @MaxLength(160)
  ownerEmail: string;

  @ApiProperty({ minLength: MIN_PASSWORD_LENGTH, example: 'unaClaveSegura1' })
  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  password: string;
}
