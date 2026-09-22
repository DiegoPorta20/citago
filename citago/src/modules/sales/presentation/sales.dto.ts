import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { MONEY_PATTERN } from '../../../shared/presentation/dto/money-pattern.js';
import { PaginationQueryDto } from '../../../shared/presentation/dto/pagination-query.dto.js';
import type { SaleView } from '../application/sale-queries.js';
import { PaymentMethod } from '../domain/payment-method.js';
import { SaleStatus } from '../domain/sale-status.js';

const MONEY_MESSAGE =
  'must be a non-negative decimal string with at most 2 decimals, e.g. "25.00"';

export class SaleLineRequestDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'A catalogue service. Its name and current price are copied into the line unless overridden here.',
  })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Required when the line is not a service.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  description?: string;

  @ApiPropertyOptional({
    example: '25.00',
    description: 'Required when the line is not a service.',
  })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN, { message: `unitPrice ${MONEY_MESSAGE}` })
  unitPrice?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 99, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;
}

export class RegisterSaleRequestDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Charges a completed appointment. Client, barber and the single line are taken from it, at the price agreed when booking.',
  })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Who did the work. STAFF users may only record their own.',
  })
  @IsOptional()
  @IsUUID()
  staffMemberId?: string;

  @ApiPropertyOptional({
    type: SaleLineRequestDto,
    isArray: true,
    description: 'Required unless `appointmentId` is given.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SaleLineRequestDto)
  lines?: SaleLineRequestDto[];

  @ApiPropertyOptional({
    example: '5.00',
    description: 'Cannot exceed the subtotal (rule SA-2).',
  })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN, { message: `discount ${MONEY_MESSAGE}` })
  discount?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description:
      'Given when the client pays on the spot; the sale is recorded as PAID. Without it the sale stays PENDING until charged.',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class PaySaleRequestDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}

export class VoidSaleRequestDto {
  @ApiProperty({
    maxLength: 255,
    description: 'Why the sale is being voided (rule SA-4). Required.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason: string;
}

export class ListSalesQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: '2026-09-01T05:00:00.000Z' })
  @IsDateString({ strict: true })
  from: string;

  @ApiProperty({
    example: '2026-10-01T05:00:00.000Z',
    description: 'At most 366 days after `from`.',
  })
  @IsDateString({ strict: true })
  to: string;

  @ApiPropertyOptional({ enum: SaleStatus })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  staffMemberId?: string;
}

class NamedRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

export class SaleLineResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  serviceId: string | null;

  @ApiProperty({ example: 'Corte de cabello' })
  description: string;

  @ApiProperty({ example: '25.00' })
  unitPrice: string;

  @ApiProperty({ example: 1 })
  quantity: number;

  @ApiProperty({ example: '25.00' })
  lineTotal: string;
}

export class SaleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: SaleStatus })
  status: SaleStatus;

  @ApiProperty({
    example: 'PEN',
    description: 'Frozen when the sale was made.',
  })
  currency: string;

  @ApiProperty({ example: '25.00' })
  subtotal: string;

  @ApiProperty({ example: '0.00' })
  discount: string;

  @ApiProperty({ example: '25.00' })
  total: string;

  @ApiPropertyOptional({ enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @ApiProperty()
  soldAt: string;

  @ApiPropertyOptional({ nullable: true })
  paidAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  voidedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  voidReason: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  appointmentId: string | null;

  @ApiProperty({ type: NamedRefDto, nullable: true })
  client: NamedRefDto | null;

  @ApiProperty({ type: NamedRefDto, nullable: true })
  staffMember: NamedRefDto | null;

  @ApiProperty({ type: SaleLineResponseDto, isArray: true })
  lines: SaleLineResponseDto[];

  static fromView(view: SaleView): SaleResponseDto {
    const snapshot = view.sale.toSnapshot();

    return {
      id: snapshot.id,
      status: snapshot.status,
      currency: snapshot.currency,
      subtotal: snapshot.subtotal,
      discount: snapshot.discount,
      total: snapshot.total,
      paymentMethod: snapshot.paymentMethod,
      soldAt: snapshot.soldAt.toISOString(),
      paidAt: snapshot.paidAt?.toISOString() ?? null,
      voidedAt: snapshot.voidedAt?.toISOString() ?? null,
      voidReason: snapshot.voidReason,
      appointmentId: snapshot.appointmentId,
      client: view.client
        ? { id: view.client.id, name: view.client.name }
        : null,
      staffMember: view.staffMember
        ? { id: view.staffMember.id, name: view.staffMember.displayName }
        : null,
      lines: snapshot.lines.map((line) => ({
        id: line.id,
        serviceId: line.serviceId,
        description: line.description,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
      })),
    };
  }
}
