import type { PhoneNumber } from '../../../shared/domain/phone-number.js';
import type { Page, PageRequest } from '../../../shared/domain/pagination.js';
import type { TimeRange } from '../../../shared/domain/time-range.js';
import type { Client } from './client.entity.js';

export interface ClientListFilters {
  readonly query?: string;
}

export abstract class ClientRepository {
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
    options?: { readonly includeDeleted?: boolean },
  ): Promise<Client | null>;

  abstract findManyByIdsForTenant(
    ids: readonly string[],
    tenantId: string,
  ): Promise<Client[]>;

  abstract findByPhone(
    tenantId: string,
    phone: PhoneNumber,
  ): Promise<Client | null>;

  abstract countCreatedBetween(
    tenantId: string,
    range: TimeRange,
  ): Promise<number>;

  abstract list(
    tenantId: string,
    filters: ClientListFilters,
    page: PageRequest,
  ): Promise<Page<Client>>;

  abstract save(client: Client): Promise<void>;
}
