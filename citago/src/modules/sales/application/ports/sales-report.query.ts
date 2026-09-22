import type { TimeRange } from '../../../../shared/domain/time-range.js';
import type { PaymentMethod } from '../../domain/payment-method.js';

export interface SalesReportFilters {
  /** Limits the figures to one staff member, for a STAFF user or a comparison. */
  readonly staffMemberId?: string;
}

/** Amounts are decimal strings, `"0.00"` when there is nothing to add up. */
export interface SalesTotals {
  /** Money actually taken: only `PAID` sales count (rule SA-5). */
  readonly paid: string;
  readonly paidCount: number;
  /** Recorded but not charged yet. */
  readonly pending: string;
  readonly pendingCount: number;
  /** Charged and given back. Never part of revenue, but worth seeing. */
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
  /** The description as it was charged, not as the catalogue reads today. */
  readonly description: string;
  readonly quantity: number;
  readonly total: string;
}

/**
 * Aggregated reads over the till, for the dashboard.
 *
 * A separate port from `SaleRepository` on purpose: that one loads and stores
 * whole sales, this one never returns an aggregate — only numbers. Keeping them
 * apart means a report can be optimized, or moved to a read replica, without
 * touching the write path.
 *
 * Every method is scoped by tenant and by a time range over `sold_at`, which
 * the caller has already resolved in the business time zone (rule TZ-2).
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
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

  /** What each barber took, best first. */
  abstract byStaffMember(
    tenantId: string,
    range: TimeRange,
  ): Promise<StaffMemberSales[]>;

  /** The best selling lines, best first. */
  abstract topServices(
    tenantId: string,
    range: TimeRange,
    limit: number,
    filters?: SalesReportFilters,
  ): Promise<ServiceSales[]>;
}
