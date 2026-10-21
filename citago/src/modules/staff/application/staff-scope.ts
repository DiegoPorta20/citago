import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { StaffRepository } from '../domain/staff.repository.js';

export type StaffScopeResult =
  | { readonly kind: 'all' }
  | { readonly kind: 'own'; readonly staffMemberId: string | null };

@Injectable()
export class StaffScope {
  constructor(private readonly staff: StaffRepository) {}

  async forActor(actor: AuthContext): Promise<StaffScopeResult> {
    if (actor.role !== UserRole.Staff) {
      return { kind: 'all' };
    }

    return { kind: 'own', staffMemberId: await this.staffMemberOf(actor) };
  }

  async staffMemberOf(actor: AuthContext): Promise<string | null> {
    const own = await this.staff.findByUserId(actor.tenantId, actor.userId);

    return own?.id ?? null;
  }
}
