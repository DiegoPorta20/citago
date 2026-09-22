import { Injectable } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';

import type { TimeRange } from '../../../../../shared/domain/time-range.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import type { PaymentMethod } from '../../../domain/payment-method.js';
import { SaleStatus } from '../../../domain/sale-status.js';
import {
  SalesReportQuery,
  type PaymentMethodTotal,
  type SalesReportFilters,
  type SalesTotals,
  type ServiceSales,
  type StaffMemberSales,
} from '../../../application/ports/sales-report.query.js';
import { SaleLineOrmEntity } from './entities/sale-line.orm-entity.js';
import { SaleOrmEntity } from './entities/sale.orm-entity.js';

const ZERO = '0.00';

/** `SUM` returns NULL when nothing matched, and `COUNT` a driver-dependent shape. */
const amount = (value: string | null): string => value ?? ZERO;
const count = (value: string | number): number => Number(value);

interface TotalsRow {
  status: SaleStatus;
  total: string | null;
  sales: string | number;
}

interface MethodRow {
  method: PaymentMethod;
  total: string | null;
  sales: string | number;
}

interface StaffRow {
  staffMemberId: string;
  total: string | null;
  sales: string | number;
}

interface ServiceRow {
  serviceId: string | null;
  description: string;
  quantity: string | number;
  total: string | null;
}

/**
 * The dashboard figures, computed by MySQL.
 *
 * Every query is served by `ix_sales_sold_at` or `ix_sales_staff_sold_at`:
 * the tenant and the period are always the leading columns, so a business with
 * years of history still reads only the rows of the period asked for.
 */
@Injectable()
export class TypeOrmSalesReportQuery extends SalesReportQuery {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get sales() {
    return this.context.manager.getRepository(SaleOrmEntity);
  }

  private get lines() {
    return this.context.manager.getRepository(SaleLineOrmEntity);
  }

  async totals(
    tenantId: string,
    range: TimeRange,
    filters: SalesReportFilters = {},
  ): Promise<SalesTotals> {
    const rows = await this.scoped(tenantId, range, filters)
      .select('sale.status', 'status')
      .addSelect('SUM(sale.total)', 'total')
      .addSelect('COUNT(*)', 'sales')
      .groupBy('sale.status')
      .getRawMany<TotalsRow>();

    const of = (status: SaleStatus) =>
      rows.find((row) => row.status === status);
    const paid = of(SaleStatus.Paid);
    const pending = of(SaleStatus.Pending);
    const refunded = of(SaleStatus.Refunded);

    return {
      paid: amount(paid?.total ?? null),
      paidCount: count(paid?.sales ?? 0),
      pending: amount(pending?.total ?? null),
      pendingCount: count(pending?.sales ?? 0),
      refunded: amount(refunded?.total ?? null),
      refundedCount: count(refunded?.sales ?? 0),
    };
  }

  async byPaymentMethod(
    tenantId: string,
    range: TimeRange,
    filters: SalesReportFilters = {},
  ): Promise<PaymentMethodTotal[]> {
    const rows = await this.scoped(tenantId, range, filters)
      .andWhere('sale.status = :status', { status: SaleStatus.Paid })
      .select('sale.payment_method', 'method')
      .addSelect('SUM(sale.total)', 'total')
      .addSelect('COUNT(*)', 'sales')
      .groupBy('sale.payment_method')
      .orderBy('total', 'DESC')
      .getRawMany<MethodRow>();

    return rows.map((row) => ({
      method: row.method,
      total: amount(row.total),
      count: count(row.sales),
    }));
  }

  async byStaffMember(
    tenantId: string,
    range: TimeRange,
  ): Promise<StaffMemberSales[]> {
    const rows = await this.scoped(tenantId, range)
      .andWhere('sale.status = :status', { status: SaleStatus.Paid })
      .andWhere('sale.staff_member_id IS NOT NULL')
      .select('sale.staff_member_id', 'staffMemberId')
      .addSelect('SUM(sale.total)', 'total')
      .addSelect('COUNT(*)', 'sales')
      .groupBy('sale.staff_member_id')
      .orderBy('total', 'DESC')
      .getRawMany<StaffRow>();

    return rows.map((row) => ({
      staffMemberId: row.staffMemberId,
      total: amount(row.total),
      count: count(row.sales),
    }));
  }

  async topServices(
    tenantId: string,
    range: TimeRange,
    limit: number,
    filters: SalesReportFilters = {},
  ): Promise<ServiceSales[]> {
    const query = this.lines
      .createQueryBuilder('line')
      .innerJoin(
        SaleOrmEntity,
        'sale',
        'sale.tenant_id = line.tenant_id AND sale.id = line.sale_id',
      )
      .where('line.tenant_id = :tenantId', { tenantId })
      .andWhere('sale.status = :status', { status: SaleStatus.Paid })
      .andWhere('sale.sold_at >= :from', { from: range.start })
      .andWhere('sale.sold_at < :to', { to: range.end });

    if (filters.staffMemberId) {
      query.andWhere('sale.staff_member_id = :staffMemberId', {
        staffMemberId: filters.staffMemberId,
      });
    }

    // Grouped by name as well as by service: the line keeps the description it
    // was sold under (rule SA-7), and a service renamed mid-period really did
    // sell under two names.
    const rows = await query
      .select('line.service_id', 'serviceId')
      .addSelect('line.description', 'description')
      .addSelect('SUM(line.quantity)', 'quantity')
      .addSelect('SUM(line.line_total)', 'total')
      .groupBy('line.service_id')
      .addGroupBy('line.description')
      .orderBy('total', 'DESC')
      .limit(limit)
      .getRawMany<ServiceRow>();

    return rows.map((row) => ({
      serviceId: row.serviceId,
      description: row.description,
      quantity: count(row.quantity),
      total: amount(row.total),
    }));
  }

  /** Tenant and period first: the shape every index here is built for. */
  private scoped(
    tenantId: string,
    range: TimeRange,
    filters: SalesReportFilters = {},
  ): SelectQueryBuilder<SaleOrmEntity> {
    const query = this.sales
      .createQueryBuilder('sale')
      .where('sale.tenant_id = :tenantId', { tenantId })
      .andWhere('sale.sold_at >= :from', { from: range.start })
      .andWhere('sale.sold_at < :to', { to: range.end });

    if (filters.staffMemberId) {
      query.andWhere('sale.staff_member_id = :staffMemberId', {
        staffMemberId: filters.staffMemberId,
      });
    }

    return query;
  }
}
