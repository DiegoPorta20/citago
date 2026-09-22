import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import {
  buildPage,
  type Page,
  type PageRequest,
} from '../../../shared/domain/pagination.js';
import { TimeRange } from '../../../shared/domain/time-range.js';
import { ClientRepository } from '../../clients/domain/client.repository.js';
import { StaffRepository } from '../../staff/domain/staff.repository.js';
import type { Sale } from '../domain/sale.entity.js';
import {
  SaleNotFoundError,
  SalesRangeTooWideError,
} from '../domain/sale.errors.js';
import { SaleRepository } from '../domain/sale.repository.js';
import type { SaleStatus } from '../domain/sale-status.js';
import { SalesAccess } from './sales-access.js';

/** A year and a day: enough for any report screen, still a bounded query. */
const MAX_SALES_DAYS = 366;

/** A sale with the names a screen needs, resolved in bulk. */
export interface SaleView {
  readonly sale: Sale;
  readonly client: { readonly id: string; readonly name: string } | null;
  readonly staffMember: {
    readonly id: string;
    readonly displayName: string;
  } | null;
}

/**
 * Attaches client and staff names to a batch of sales.
 *
 * Two queries for the whole page, whatever its size — never one per row — and
 * each through the owning module's repository, never its tables.
 */
@Injectable()
export class SaleViewAssembler {
  constructor(
    private readonly clients: ClientRepository,
    private readonly staff: StaffRepository,
  ) {}

  async assemble(
    tenantId: string,
    sales: readonly Sale[],
  ): Promise<SaleView[]> {
    const ids = (values: readonly (string | null)[]) => [
      ...new Set(values.filter((value): value is string => Boolean(value))),
    ];

    const [clients, staff] = await Promise.all([
      this.clients.findManyByIdsForTenant(
        ids(sales.map((sale) => sale.clientId)),
        tenantId,
      ),
      this.staff.findManyByIdsForTenant(
        ids(sales.map((sale) => sale.staffMemberId)),
        tenantId,
      ),
    ]);

    const clientById = new Map(clients.map((client) => [client.id, client]));
    const staffById = new Map(staff.map((member) => [member.id, member]));

    return sales.map((sale) => {
      const client = sale.clientId ? clientById.get(sale.clientId) : undefined;
      const member = sale.staffMemberId
        ? staffById.get(sale.staffMemberId)
        : undefined;

      return {
        sale,
        client: client ? { id: client.id, name: client.name } : null,
        staffMember: member
          ? { id: member.id, displayName: member.displayName }
          : null,
      };
    });
  }
}

@Injectable()
export class GetSaleUseCase {
  constructor(
    private readonly sales: SaleRepository,
    private readonly access: SalesAccess,
    private readonly assembler: SaleViewAssembler,
  ) {}

  async execute(actor: AuthContext, saleId: string): Promise<SaleView> {
    const sale = await this.sales.findByIdForTenant(saleId, actor.tenantId);

    if (!sale) {
      throw new SaleNotFoundError();
    }

    await this.access.assertCanSee(actor, sale);

    const [view] = await this.assembler.assemble(actor.tenantId, [sale]);

    return view;
  }
}

export interface ListSalesInput extends PageRequest {
  readonly from: Date;
  readonly to: Date;
  readonly status?: SaleStatus;
  readonly clientId?: string;
  readonly staffMemberId?: string;
}

/**
 * The till: sales recorded inside a time range.
 *
 * STAFF users only ever see their own, whatever filter they send
 * (docs/permissions.md). A STAFF account not linked to a staff member gets an
 * empty list rather than an error — same as the agenda.
 */
@Injectable()
export class ListSalesUseCase {
  constructor(
    private readonly sales: SaleRepository,
    private readonly access: SalesAccess,
    private readonly assembler: SaleViewAssembler,
  ) {}

  async execute(
    actor: AuthContext,
    input: ListSalesInput,
  ): Promise<Page<SaleView>> {
    const range = TimeRange.of(input.from, input.to);

    if (range.durationMinutes > MAX_SALES_DAYS * 24 * 60) {
      throw new SalesRangeTooWideError(MAX_SALES_DAYS);
    }

    const scope = await this.access.scopeFor(actor);
    const page = { page: input.page, limit: input.limit };

    if (scope.kind === 'own' && scope.staffMemberId === null) {
      return buildPage([], 0, page);
    }

    // A STAFF user asking for someone else's sales simply gets none.
    if (
      scope.kind === 'own' &&
      input.staffMemberId !== undefined &&
      input.staffMemberId !== scope.staffMemberId
    ) {
      return buildPage([], 0, page);
    }

    const staffMemberId =
      scope.kind === 'own' ? scope.staffMemberId : input.staffMemberId;

    const result = await this.sales.list(
      actor.tenantId,
      {
        range,
        status: input.status,
        clientId: input.clientId,
        staffMemberId: staffMemberId ?? undefined,
      },
      page,
    );

    return {
      items: await this.assembler.assemble(actor.tenantId, result.items),
      meta: result.meta,
    };
  }
}
