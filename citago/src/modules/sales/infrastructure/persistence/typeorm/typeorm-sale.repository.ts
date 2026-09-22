import { Injectable } from '@nestjs/common';
import { In, QueryFailedError } from 'typeorm';

import {
  buildPage,
  offsetOf,
  type Page,
  type PageRequest,
} from '../../../../../shared/domain/pagination.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { Sale } from '../../../domain/sale.entity.js';
import type { SaleLineSnapshot } from '../../../domain/sale-line.js';
import { AppointmentAlreadyBilledError } from '../../../domain/sale.errors.js';
import {
  SaleRepository,
  type SaleListFilters,
} from '../../../domain/sale.repository.js';
import { SaleLineOrmEntity } from './entities/sale-line.orm-entity.js';
import { SaleOrmEntity } from './entities/sale.orm-entity.js';

/** MySQL reports a unique-key violation with this code and the key name. */
function isDuplicateOn(error: unknown, keyName: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: string; message?: string };

  return (
    driverError.code === 'ER_DUP_ENTRY' &&
    (driverError.message ?? '').includes(keyName)
  );
}

@Injectable()
export class TypeOrmSaleRepository extends SaleRepository {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get sales() {
    return this.context.manager.getRepository(SaleOrmEntity);
  }

  private get lines() {
    return this.context.manager.getRepository(SaleLineOrmEntity);
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<Sale | null> {
    const row = await this.sales.findOneBy({ id, tenantId });

    return row ? this.toDomain(row, await this.linesOf(tenantId, [id])) : null;
  }

  async findByAppointmentId(
    tenantId: string,
    appointmentId: string,
  ): Promise<Sale | null> {
    const row = await this.sales.findOneBy({ tenantId, appointmentId });

    if (!row) {
      return null;
    }

    return this.toDomain(row, await this.linesOf(tenantId, [row.id]));
  }

  async list(
    tenantId: string,
    filters: SaleListFilters,
    page: PageRequest,
  ): Promise<Page<Sale>> {
    const query = this.sales
      .createQueryBuilder('sale')
      .where('sale.tenant_id = :tenantId', { tenantId })
      .andWhere('sale.sold_at >= :from', { from: filters.range.start })
      .andWhere('sale.sold_at < :to', { to: filters.range.end });

    if (filters.status) {
      query.andWhere('sale.status = :status', { status: filters.status });
    }
    if (filters.clientId) {
      query.andWhere('sale.client_id = :clientId', {
        clientId: filters.clientId,
      });
    }
    if (filters.staffMemberId) {
      query.andWhere('sale.staff_member_id = :staffMemberId', {
        staffMemberId: filters.staffMemberId,
      });
    }

    const [rows, total] = await query
      .orderBy('sale.sold_at', 'DESC')
      .addOrderBy('sale.id', 'DESC')
      .skip(offsetOf(page))
      .take(page.limit)
      .getManyAndCount();

    // One query for the lines of the whole page, never one per sale.
    const linesBySale = await this.linesOf(
      tenantId,
      rows.map((row) => row.id),
    );

    return buildPage(
      rows.map((row) => this.toDomain(row, linesBySale)),
      total,
      page,
    );
  }

  async save(sale: Sale): Promise<void> {
    const snapshot = sale.toSnapshot();
    const row = new SaleOrmEntity();

    row.id = snapshot.id;
    row.tenantId = snapshot.tenantId;
    row.appointmentId = snapshot.appointmentId;
    row.clientId = snapshot.clientId;
    row.staffMemberId = snapshot.staffMemberId;
    row.status = snapshot.status;
    row.currency = snapshot.currency;
    row.subtotal = snapshot.subtotal;
    row.discount = snapshot.discount;
    row.total = snapshot.total;
    row.paymentMethod = snapshot.paymentMethod;
    row.soldAt = snapshot.soldAt;
    row.paidAt = snapshot.paidAt;
    row.voidedAt = snapshot.voidedAt;
    row.voidReason = snapshot.voidReason;
    row.voidedByUserId = snapshot.voidedByUserId;
    row.createdByUserId = snapshot.createdByUserId;
    row.createdAt = snapshot.createdAt;
    row.updatedAt = snapshot.updatedAt;

    try {
      await this.sales.save(row);
    } catch (error) {
      // Rule SA-3 under concurrency: two tills charging the same appointment
      // both pass the application check, and the unique key settles it.
      if (isDuplicateOn(error, 'uq_sales_appointment')) {
        throw new AppointmentAlreadyBilledError();
      }

      throw error;
    }

    // Lines are immutable, so re-saving an existing sale rewrites identical
    // rows rather than needing to know whether this is the first save.
    await this.lines.upsert(
      snapshot.lines.map((line, position) => ({
        id: line.id,
        tenantId: snapshot.tenantId,
        saleId: snapshot.id,
        serviceId: line.serviceId,
        description: line.description,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
        position,
      })),
      ['id'],
    );
  }

  /** The lines of the given sales, grouped by sale and kept in order. */
  private async linesOf(
    tenantId: string,
    saleIds: readonly string[],
  ): Promise<Map<string, SaleLineSnapshot[]>> {
    const grouped = new Map<string, SaleLineSnapshot[]>();

    if (saleIds.length === 0) {
      return grouped;
    }

    const rows = await this.lines.find({
      where: { tenantId, saleId: In([...saleIds]) },
      order: { saleId: 'ASC', position: 'ASC' },
    });

    for (const row of rows) {
      const lines = grouped.get(row.saleId) ?? [];

      lines.push({
        id: row.id,
        serviceId: row.serviceId,
        description: row.description,
        unitPrice: row.unitPrice,
        quantity: row.quantity,
        lineTotal: row.lineTotal,
      });
      grouped.set(row.saleId, lines);
    }

    return grouped;
  }

  private toDomain(
    row: SaleOrmEntity,
    linesBySale: Map<string, SaleLineSnapshot[]>,
  ): Sale {
    return Sale.restore({
      id: row.id,
      tenantId: row.tenantId,
      appointmentId: row.appointmentId,
      clientId: row.clientId,
      staffMemberId: row.staffMemberId,
      status: row.status,
      currency: row.currency,
      subtotal: row.subtotal,
      discount: row.discount,
      total: row.total,
      paymentMethod: row.paymentMethod,
      soldAt: row.soldAt,
      paidAt: row.paidAt,
      voidedAt: row.voidedAt,
      voidReason: row.voidReason,
      voidedByUserId: row.voidedByUserId,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lines: linesBySale.get(row.id) ?? [],
    });
  }
}
