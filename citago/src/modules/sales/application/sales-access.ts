import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import {
  StaffScope,
  type StaffScopeResult,
} from '../../staff/application/staff-scope.js';
import type { Sale } from '../domain/sale.entity.js';
import { OwnSalesOnlyError, SaleNotFoundError } from '../domain/sale.errors.js';

export type SalesScope = StaffScopeResult;

@Injectable()
export class SalesAccess {
  constructor(private readonly scope: StaffScope) {}

  scopeFor(actor: AuthContext): Promise<SalesScope> {
    return this.scope.forActor(actor);
  }

  async assertCanRecordFor(
    actor: AuthContext,
    staffMemberId: string | null,
  ): Promise<void> {
    const scope = await this.scopeFor(actor);

    if (scope.kind === 'own' && scope.staffMemberId !== staffMemberId) {
      throw new OwnSalesOnlyError();
    }
  }

  async assertCanSee(actor: AuthContext, sale: Sale): Promise<void> {
    const scope = await this.scopeFor(actor);

    if (scope.kind === 'own' && scope.staffMemberId !== sale.staffMemberId) {
      throw new SaleNotFoundError();
    }
  }
}
