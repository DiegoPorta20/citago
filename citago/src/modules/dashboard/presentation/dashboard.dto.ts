import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

import { AppointmentStatus } from '../../appointments/domain/appointment-status.js';
import { PaymentMethod } from '../../sales/domain/payment-method.js';
import type { BusinessDashboard } from '../application/get-business-dashboard.use-case.js';
import type { OwnDashboard } from '../application/get-own-dashboard.use-case.js';

/** `YYYY-MM-DD`, a day on the business's own calendar. */
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class DashboardPeriodQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-01',
    description:
      'Local date in the business time zone. Defaults to today there.',
  })
  @IsOptional()
  @Matches(LOCAL_DATE_PATTERN, { message: 'from must be a date, YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Local date, inclusive. Defaults to `from`. At most 366 days.',
  })
  @IsOptional()
  @Matches(LOCAL_DATE_PATTERN, { message: 'to must be a date, YYYY-MM-DD' })
  to?: string;
}

class PeriodDto {
  @ApiProperty({ example: '2026-09-01' })
  from: string;

  @ApiProperty({ example: '2026-09-30' })
  to: string;

  @ApiProperty({ example: 'America/Lima' })
  timezone: string;
}

class StatusCountDto {
  @ApiProperty({ enum: AppointmentStatus })
  status: AppointmentStatus;

  @ApiProperty({ example: 12 })
  count: number;
}

class AppointmentCountersDto {
  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ type: StatusCountDto, isArray: true })
  byStatus: StatusCountDto[];

  @ApiProperty({ example: 30 })
  completed: number;

  @ApiProperty({ example: 5 })
  cancelled: number;

  @ApiProperty({ example: 2 })
  noShow: number;
}

class PaymentMethodTotalDto {
  @ApiProperty({ enum: PaymentMethod })
  method: PaymentMethod;

  @ApiProperty({ example: '640.00' })
  total: string;

  @ApiProperty({ example: 21 })
  count: number;
}

class RevenueDto {
  @ApiProperty({
    example: '820.00',
    description: 'Money taken: only PAID sales count (rule SA-5).',
  })
  paid: string;

  @ApiProperty({ example: 28 })
  paidCount: number;

  @ApiProperty({ example: '50.00', description: 'Recorded, not charged yet.' })
  pending: string;

  @ApiProperty({ example: 2 })
  pendingCount: number;

  @ApiProperty({ example: '25.00' })
  refunded: string;

  @ApiProperty({ example: 1 })
  refundedCount: number;

  @ApiProperty({ type: PaymentMethodTotalDto, isArray: true })
  byPaymentMethod: PaymentMethodTotalDto[];
}

class ServiceSalesDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  serviceId: string | null;

  @ApiProperty({
    example: 'Corte de cabello',
    description: 'As it was charged, not as the catalogue reads today.',
  })
  description: string;

  @ApiProperty({ example: 18 })
  quantity: number;

  @ApiProperty({ example: '450.00' })
  total: string;
}

class StaffPerformanceDto {
  @ApiProperty({ format: 'uuid' })
  staffMemberId: string;

  @ApiProperty({ example: 'Carlos' })
  name: string;

  @ApiProperty({ example: 16 })
  completedAppointments: number;

  @ApiProperty({ example: 1 })
  noShowAppointments: number;

  @ApiProperty({ example: '400.00' })
  revenue: string;

  @ApiProperty({ example: 16 })
  saleCount: number;
}

export class BusinessDashboardResponseDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({ type: RevenueDto })
  revenue: RevenueDto;

  @ApiProperty({ type: AppointmentCountersDto })
  appointments: AppointmentCountersDto;

  @ApiProperty({ example: { created: 4 } })
  clients: { created: number };

  @ApiProperty({ type: ServiceSalesDto, isArray: true })
  topServices: ServiceSalesDto[];

  @ApiProperty({ type: StaffPerformanceDto, isArray: true })
  staff: StaffPerformanceDto[];

  static fromResult(result: BusinessDashboard): BusinessDashboardResponseDto {
    return {
      period: { ...result.period },
      currency: result.currency,
      revenue: {
        paid: result.revenue.paid,
        paidCount: result.revenue.paidCount,
        pending: result.revenue.pending,
        pendingCount: result.revenue.pendingCount,
        refunded: result.revenue.refunded,
        refundedCount: result.revenue.refundedCount,
        byPaymentMethod: result.revenue.byPaymentMethod.map((row) => ({
          ...row,
        })),
      },
      appointments: countersDto(result.appointments),
      clients: { created: result.clients.created },
      topServices: result.topServices.map((row) => ({ ...row })),
      staff: result.staff.map((row) => ({ ...row })),
    };
  }
}

export class OwnDashboardResponseDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  staffMemberId: string | null;

  @ApiProperty({ type: AppointmentCountersDto })
  appointments: AppointmentCountersDto;

  static fromResult(result: OwnDashboard): OwnDashboardResponseDto {
    return {
      period: { ...result.period },
      staffMemberId: result.staffMemberId,
      appointments: countersDto(result.appointments),
    };
  }
}

function countersDto(
  counters: BusinessDashboard['appointments'],
): AppointmentCountersDto {
  return {
    total: counters.total,
    byStatus: counters.byStatus.map((row) => ({ ...row })),
    completed: counters.completed,
    cancelled: counters.cancelled,
    noShow: counters.noShow,
  };
}
