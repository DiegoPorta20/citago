import type { Page, PageRequest } from '../../../shared/domain/pagination.js';
import type { TimeRange } from '../../../shared/domain/time-range.js';
import type { Sale } from './sale.entity.js';
import type { SaleStatus } from './sale-status.js';

export interface SaleListFilters {
  readonly range: TimeRange;
  readonly status?: SaleStatus;
  readonly clientId?: string;
  readonly staffMemberId?: string;
}

export abstract class SaleRepository {
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Sale | null>;

  abstract findByAppointmentId(
    tenantId: string,
    appointmentId: string,
  ): Promise<Sale | null>;

  abstract list(
    tenantId: string,
    filters: SaleListFilters,
    page: PageRequest,
  ): Promise<Page<Sale>>;

  abstract save(sale: Sale): Promise<void>;
}
