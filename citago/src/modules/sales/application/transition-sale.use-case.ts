import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import type { PaymentMethod } from '../domain/payment-method.js';
import type { Sale } from '../domain/sale.entity.js';
import { SaleNotFoundError } from '../domain/sale.errors.js';
import { SaleRepository } from '../domain/sale.repository.js';
import type { SaleStatus } from '../domain/sale-status.js';
import { SalesAccess } from './sales-access.js';

export interface TransitionSaleInput {
  readonly saleId: string;
  readonly target: SaleStatus;
  /** Required when cancelling or refunding (rule SA-4). */
  readonly reason?: string | null;
  /** Required when charging a pending sale. */
  readonly paymentMethod?: PaymentMethod | null;
}

/**
 * Charges, cancels or refunds a sale.
 *
 * One use case rather than three: they are the same business action — "settle
 * this sale" — and what differs between them lives in the domain's state
 * machine. The HTTP layer still exposes one explicit endpoint per action, and
 * restricts cancelling and refunding to OWNER and ADMIN.
 *
 * Nothing else about a sale can be changed: there is no update use case, on
 * purpose (rule SA-4).
 */
@Injectable()
export class TransitionSaleUseCase {
  constructor(
    private readonly sales: SaleRepository,
    private readonly access: SalesAccess,
    private readonly transaction: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(actor: AuthContext, input: TransitionSaleInput): Promise<Sale> {
    return this.transaction.run(async () => {
      const sale = await this.sales.findByIdForTenant(
        input.saleId,
        actor.tenantId,
      );

      if (!sale) {
        throw new SaleNotFoundError();
      }

      await this.access.assertCanSee(actor, sale);

      sale.transitionTo(
        input.target,
        {
          actorUserId: actor.userId,
          reason: input.reason,
          paymentMethod: input.paymentMethod,
        },
        this.clock.now(),
      );

      await this.sales.save(sale);

      return sale;
    });
  }
}
