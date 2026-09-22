import { Injectable } from '@nestjs/common';
import {
  And,
  In,
  IsNull,
  LessThan,
  MoreThanOrEqual,
  QueryFailedError,
} from 'typeorm';

import {
  buildPage,
  offsetOf,
  type Page,
  type PageRequest,
} from '../../../../../shared/domain/pagination.js';
import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import type { TimeRange } from '../../../../../shared/domain/time-range.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { Client } from '../../../domain/client.entity.js';
import {
  ClientRepository,
  type ClientListFilters,
} from '../../../domain/client.repository.js';
import { ClientPhoneAlreadyRegisteredError } from '../../../domain/errors/clients.errors.js';
import { ClientOrmEntity } from './entities/client.orm-entity.js';

/** Minimum digits before a search term is also matched against phones. */
const MIN_PHONE_DIGITS = 3;

@Injectable()
export class TypeOrmClientRepository extends ClientRepository {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get repository() {
    return this.context.manager.getRepository(ClientOrmEntity);
  }

  async findByIdForTenant(
    id: string,
    tenantId: string,
    options: { readonly includeDeleted?: boolean } = {},
  ): Promise<Client | null> {
    const row = await this.repository.findOneBy({
      id,
      tenantId,
      ...(options.includeDeleted ? {} : { deletedAt: IsNull() }),
    });

    return row ? this.toDomain(row) : null;
  }

  async findManyByIdsForTenant(
    ids: readonly string[],
    tenantId: string,
  ): Promise<Client[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.repository.findBy({ id: In([...ids]), tenantId });

    return rows.map((row) => this.toDomain(row));
  }

  async findByPhone(
    tenantId: string,
    phone: PhoneNumber,
  ): Promise<Client | null> {
    // Deliberately includes deleted clients: they still own their number.
    const row = await this.repository.findOneBy({
      tenantId,
      phoneE164: phone.value,
    });

    return row ? this.toDomain(row) : null;
  }

  async countCreatedBetween(
    tenantId: string,
    range: TimeRange,
  ): Promise<number> {
    return this.repository.count({
      where: {
        tenantId,
        deletedAt: IsNull(),
        createdAt: And(MoreThanOrEqual(range.start), LessThan(range.end)),
      },
    });
  }

  async list(
    tenantId: string,
    filters: ClientListFilters,
    page: PageRequest,
  ): Promise<Page<Client>> {
    const query = this.repository
      .createQueryBuilder('client')
      .where('client.tenant_id = :tenantId', { tenantId })
      .andWhere('client.deleted_at IS NULL');

    if (filters.query) {
      const digits = filters.query.replace(/\D/g, '');

      if (digits.length >= MIN_PHONE_DIGITS) {
        // "999 999" should find +51999999999. Phones are matched by digits
        // anywhere; at the size of one business's client list that scan is
        // cheap, and it is bounded by tenant_id.
        query.andWhere(
          '(client.name LIKE :namePrefix OR client.phone_e164 LIKE :phoneDigits)',
          { namePrefix: `${filters.query}%`, phoneDigits: `%${digits}%` },
        );
      } else {
        // Prefix match keeps the (tenant_id, name) index usable.
        query.andWhere('client.name LIKE :namePrefix', {
          namePrefix: `${filters.query}%`,
        });
      }
    }

    const [rows, total] = await query
      .orderBy('client.name', 'ASC')
      .addOrderBy('client.id', 'ASC')
      .skip(offsetOf(page))
      .take(page.limit)
      .getManyAndCount();

    return buildPage(
      rows.map((row) => this.toDomain(row)),
      total,
      page,
    );
  }

  async save(client: Client): Promise<void> {
    const snapshot = client.toSnapshot();
    const row = new ClientOrmEntity();

    row.id = snapshot.id;
    row.tenantId = snapshot.tenantId;
    row.name = snapshot.name;
    row.phoneE164 = snapshot.phoneE164;
    row.email = snapshot.email;
    row.notes = snapshot.notes;
    row.deletedAt = snapshot.deletedAt;
    row.createdAt = snapshot.createdAt;
    row.updatedAt = snapshot.updatedAt;

    try {
      await this.repository.save(row);
    } catch (error) {
      // The use case already checked, but two simultaneous requests can both
      // pass that check. The unique key settles it; translate the driver error
      // so the caller gets a 409, never a 500 with SQL in it.
      if (isDuplicatePhone(error)) {
        throw new ClientPhoneAlreadyRegisteredError();
      }

      throw error;
    }
  }

  private toDomain(row: ClientOrmEntity): Client {
    return Client.restore({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      phoneE164: row.phoneE164,
      email: row.email,
      notes: row.notes,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

function isDuplicatePhone(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: string; message?: string };

  return (
    driverError.code === 'ER_DUP_ENTRY' &&
    (driverError.message ?? '').includes('uq_clients_tenant_phone')
  );
}
