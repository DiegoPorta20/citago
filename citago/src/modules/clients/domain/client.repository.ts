import type { PhoneNumber } from '../../../shared/domain/phone-number.js';
import type { Page, PageRequest } from '../../../shared/domain/pagination.js';
import type { TimeRange } from '../../../shared/domain/time-range.js';
import type { Client } from './client.entity.js';

export interface ClientListFilters {
  /** Matches the start of the name, or digits anywhere in the phone number. */
  readonly query?: string;
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
   * Batch lookup for views that show many appointments at once. Includes
   * deleted clients: a past appointment must still show who it was for.
   */
  abstract findManyByIdsForTenant(
    ids: readonly string[],
    tenantId: string,
  ): Promise<Client[]>;

  /**
   * The identity lookup: it is how WhatsApp will find an existing customer, and
   * how a duplicate is detected before creating one.
   *
   * Includes deleted clients, because a soft-deleted client still holds its
   * phone and must be offered for restore rather than duplicated.
   */
  abstract findByPhone(
    tenantId: string,
    phone: PhoneNumber,
  ): Promise<Client | null>;

  /**
   * How many clients the business gained in a period, for the dashboard.
   * Counts by `created_at` and ignores deleted ones.
   */
  abstract countCreatedBetween(
    tenantId: string,
    range: TimeRange,
  ): Promise<number>;

  /** Never returns deleted clients. */
  abstract list(
    tenantId: string,
    filters: ClientListFilters,
    page: PageRequest,
  ): Promise<Page<Client>>;

  /**
   * Throws `ClientPhoneAlreadyRegisteredError` when the database rejects a
   * duplicate phone — the race two simultaneous sign-ups can still hit after
   * the use case checked.
   */
  abstract save(client: Client): Promise<void>;
}
