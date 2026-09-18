import {
  buildPage,
  offsetOf,
  type Page,
  type PageRequest,
} from '../../../src/shared/domain/pagination.js';
import type { PhoneNumber } from '../../../src/shared/domain/phone-number.js';
import type { Client } from '../../../src/modules/clients/domain/client.entity.js';
import {
  ClientRepository,
  type ClientListFilters,
} from '../../../src/modules/clients/domain/client.repository.js';

/**
 * In-memory client repository honouring tenant scoping, soft delete and the
 * "deleted clients still own their phone" rule.
 */
export class InMemoryClientRepository extends ClientRepository {
  readonly clients = new Map<string, Client>();

  async findByIdForTenant(
    id: string,
    tenantId: string,
    options: { readonly includeDeleted?: boolean } = {},
  ): Promise<Client | null> {
    const client = this.clients.get(id);

    if (!client || client.tenantId !== tenantId) {
      return null;
    }
    if (client.isDeleted && !options.includeDeleted) {
      return null;
    }

    return client;
  }

  async findManyByIdsForTenant(
    ids: readonly string[],
    tenantId: string,
  ): Promise<Client[]> {
    return [...this.clients.values()].filter(
      (client) => client.tenantId === tenantId && ids.includes(client.id),
    );
  }

  async findByPhone(
    tenantId: string,
    phone: PhoneNumber,
  ): Promise<Client | null> {
    return (
      [...this.clients.values()].find(
        (client) =>
          client.tenantId === tenantId && client.phone?.value === phone.value,
      ) ?? null
    );
  }

  async list(
    tenantId: string,
    filters: ClientListFilters,
    page: PageRequest,
  ): Promise<Page<Client>> {
    const digits = filters.query?.replace(/\D/g, '') ?? '';

    const matches = [...this.clients.values()]
      .filter((client) => client.tenantId === tenantId && !client.isDeleted)
      .filter((client) => {
        if (!filters.query) {
          return true;
        }

        const byName = client.name
          .toLowerCase()
          .startsWith(filters.query.toLowerCase());
        const byPhone =
          digits.length >= 3 && (client.phone?.value.includes(digits) ?? false);

        return byName || byPhone;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const offset = offsetOf(page);

    return buildPage(
      matches.slice(offset, offset + page.limit),
      matches.length,
      page,
    );
  }

  async save(client: Client): Promise<void> {
    this.clients.set(client.id, client);
  }
}
