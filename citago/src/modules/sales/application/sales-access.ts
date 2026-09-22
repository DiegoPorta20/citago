import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import {
  StaffScope,
  type StaffScopeResult,
} from '../../staff/application/staff-scope.js';
import type { Sale } from '../domain/sale.entity.js';
import { OwnSalesOnlyError, SaleNotFoundError } from '../domain/sale.errors.js';

/** Which sales a caller can see: their own work, or the whole till. */
export type SalesScope = StaffScopeResult;

/**
 * The per-resource half of authorization for sales (docs/permissions.md):
 * OWNER and ADMIN see the whole till, STAFF only what they charged themselves.
 *
 * Both halves start from the same question — which staff member is behind this
 * session — answered once by `StaffScope`. What differs is the consequence: an
 * appointment out of reach is not found, a sale recorded for someone else is
 * forbidden.
 */
@Injectable()
export class SalesAccess {
  constructor(private readonly scope: StaffScope) {}

  scopeFor(actor: AuthContext): Promise<SalesScope> {
    return this.scope.forActor(actor);
  }

  /**
   * For writes: a STAFF user records sales for their own work and no one
   * else's, and cannot record one that is attributed to nobody.
   */
  async assertCanRecordFor(
    actor: AuthContext,
    staffMemberId: string | null,
  ): Promise<void> {
    const scope = await this.scopeFor(actor);

    if (scope.kind === 'own' && scope.staffMemberId !== staffMemberId) {
      throw new OwnSalesOnlyError();
    }
  }

  /** For reads: a sale outside the caller's scope is reported as not found. */
  async assertCanSee(actor: AuthContext, sale: Sale): Promise<void> {
    const scope = await this.scopeFor(actor);

    if (scope.kind === 'own' && scope.staffMemberId !== sale.staffMemberId) {
      throw new SaleNotFoundError();
    }
  }
}
