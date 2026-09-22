import type { Page, PageRequest } from '../../../shared/domain/pagination.js';
import type { TimeRange } from '../../../shared/domain/time-range.js';
import type { Sale } from './sale.entity.js';
import type { SaleStatus } from './sale-status.js';

export interface SaleListFilters {
  /** Sales sold inside this range. Required: a sales list is always bounded. */
  readonly range: TimeRange;
  readonly status?: SaleStatus;
  readonly clientId?: string;
  readonly staffMemberId?: string;
}

/**
 * Persistence contract for sales.
 *
 * **Every method takes `tenantId`** (see docs/adr/0004-tenant-isolation.md).
 *
 * A sale always comes back with its lines: they are part of the aggregate, not
 * a separate thing to fetch.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class SaleRepository {
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Sale | null>;

  /** Rule SA-3: used to refuse a second sale for the same appointment. */
  abstract findByAppointmentId(
    tenantId: string,
    appointmentId: string,
  ): Promise<Sale | null>;

  abstract list(
    tenantId: string,
    filters: SaleListFilters,
    page: PageRequest,
  ): Promise<Page<Sale>>;

  /** Persists the sale and, the first time, its lines. Lines never change. */
  abstract save(sale: Sale): Promise<void>;
}
