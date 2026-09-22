import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { ScheduleRangeDto } from '../../../shared/presentation/dto/schedule-range.dto.js';
import type { BusinessView } from '../application/business.use-cases.js';
import { BusinessType } from '../domain/business-type.js';
import { TenantStatus } from '../domain/tenant-status.js';

/**
 * Partial update: only the fields present are applied.
 *
 * `currency` is **not** here, and a request that sends it is rejected by the
 * global whitelist. Every price in the catalogue is stored as a bare amount in
 * the tenant currency, so switching it would reprice the whole shop without
 * touching a single price.
 */
export class UpdateBusinessRequestDto {
  @ApiPropertyOptional({ example: 'Barbería Los Ángeles', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'PE',
    description:
      'ISO 3166-1 alpha-2. Used as the default region when a phone is written without a country code.',
  })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, {
    message: 'country must be an ISO 3166-1 alpha-2 code',
  })
  country?: string;

  @ApiPropertyOptional({
    example: 'America/Lima',
    description:
      'IANA time zone. The agenda and the daily totals are computed in it from now on; stored instants are UTC and are not rewritten.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    example: '999999999',
    nullable: true,
    description:
      'Normalized to E.164 with the business country. Null clears it.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateBusinessRequestDto) => dto.phone !== null)
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'hola@barberia.pe' })
  @IsOptional()
  @ValidateIf((dto: UpdateBusinessRequestDto) => dto.email !== null)
  @IsEmail()
  @MaxLength(160)
  email?: string | null;
}

export class ReplaceBusinessHoursRequestDto {
  @ApiProperty({
    type: ScheduleRangeDto,
    isArray: true,
    description:
      'The whole week. Several ranges on one day model a midday close; a day with none is a day the shop does not open.',
  })
  @IsArray()
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => ScheduleRangeDto)
  ranges: ScheduleRangeDto[];
}

export class BusinessResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Barbería Los Ángeles' })
  name: string;

  @ApiProperty({ example: 'barberia-los-angeles' })
  slug: string;

  @ApiProperty({ enum: BusinessType })
  businessType: BusinessType;

  @ApiProperty({ example: 'PE' })
  country: string;

  @ApiProperty({
    example: 'PEN',
    description: 'Fixed at sign-up: every price in the catalogue is in it.',
  })
  currency: string;

  @ApiProperty({ example: 'America/Lima' })
  timezone: string;

  @ApiPropertyOptional({ nullable: true, example: '+51999999999' })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiProperty({ enum: TenantStatus })
  status: TenantStatus;

  @ApiProperty({
    type: ScheduleRangeDto,
    isArray: true,
    description:
      'When the shop is open. Informative: what gates a booking is the staff schedule (rule AP-14).',
  })
  hours: ScheduleRangeDto[];

  static fromView(view: BusinessView): BusinessResponseDto {
    const tenant = view.tenant.toSnapshot();

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      businessType: tenant.businessType,
      country: tenant.country,
      currency: tenant.currency,
      timezone: tenant.timezone,
      phone: tenant.phone,
      email: tenant.email,
      status: tenant.status,
      hours: view.hours.all().map((range) => ({
        weekday: range.weekday,
        startsAt: range.startsAt.toString(),
        endsAt: range.endsAt.toString(),
      })),
    };
  }
}
