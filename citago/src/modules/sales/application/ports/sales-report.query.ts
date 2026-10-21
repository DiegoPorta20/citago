import type { TimeRange } from '../../../../shared/domain/time-range.js';
import type { PaymentMethod } from '../../domain/payment-method.js';

export interface SalesReportFilters {
  readonly staffMemberId?: string;
}

export interface SalesTotals {
  readonly paid: string;
  readonly paidCount: number;
  readonly pending: string;
  readonly pendingCount: number;
  readonly refunded: string;
  readonly refundedCount: number;
}

export interface PaymentMethodTotal {
  readonly method: PaymentMethod;
  readonly total: string;
  readonly count: number;
}

export interface StaffMemberSales {
  readonly staffMemberId: string;
  readonly total: string;
  readonly count: number;
}

export interface ServiceSales {
  readonly serviceId: string | null;
  readonly description: string;
  readonly quantity: number;
  readonly total: string;
}

export abstract class SalesReportQuery {
  abstract totals(
    tenantId: string,
    range: TimeRange,
    filters?: SalesReportFilters,
  ): Promise<SalesTotals>;

  abstract byPaymentMethod(
    tenantId: string,
    range: TimeRange,
    filters?: SalesReportFilters,
  ): Promise<PaymentMethodTotal[]>;

  abstract byStaffMember(
    tenantId: string,
    range: TimeRange,
  ): Promise<StaffMemberSales[]>;

  abstract topServices(
    tenantId: string,
    range: TimeRange,
    limit: number,
    filters?: SalesReportFilters,
  ): Promise<ServiceSales[]>;
}
