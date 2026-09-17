import type { PhoneNumber } from '../../../shared/domain/phone-number.js';
import type { Page, PageRequest } from '../../../shared/domain/pagination.js';
import type { Client } from './client.entity.js';

export interface ClientListFilters {
  /** Matches the start of the name, or any part of the phone number. */
  readonly query?: string;
  /** Deleted clients are hidden unless explicitly asked for. */
  readonly includeDeleted?: boolean;
}

/**
 * Persistence contract for clients.
 *
 * **Every method takes `tenantId`.** There is no lookup by id alone: that is
 * the hole an IDOR needs (see docs/adr/0004-tenant-isolation.md).
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class ClientRepository {
  /**
   * Deleted clients are excluded unless `includeDeleted` is set — only the
   * restore flow needs to see them.
   */
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
    options?: { readonly includeDeleted?: boolean },
  ): Promise<Client | null>;

  /**
   * The identity lookup: it is how WhatsApp finds an existing customer, and
   * how a duplicate is detected before creating one.
   *
   * Includes deleted clients, because a soft-deleted client still holds its
   * phone and must be offered for restore rather than duplicated.
   */
  abstract findByPhone(
    tenantId: string,
    phone: PhoneNumber,
  ): Promise<Client | null>;

  abstract list(
    tenantId: string,
    filters: ClientListFilters,
    page: PageRequest,
  ): Promise<Page<Client>>;

  abstract save(client: Client): Promise<void>;
}
