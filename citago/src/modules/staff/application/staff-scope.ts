import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { StaffRepository } from '../domain/staff.repository.js';

/**
 * Which staff members a caller's data covers.
 *
 * `own` with a `null` id is a STAFF account that is not linked to any staff
 * member: it owns nothing, which is a real state and not an error — the callers
 * answer it with an empty agenda, an empty till and zeroed metrics.
 */
export type StaffScopeResult =
  | { readonly kind: 'all' }
  | { readonly kind: 'own'; readonly staffMemberId: string | null };

/**
 * Resolves "the staff member behind this session", the question every
 * per-resource rule about STAFF users starts from: their own agenda, their own
 * sales, their own numbers (docs/permissions.md).
 *
 * It lives in the staff module because that is what owns the link between a
 * user account and a staff member. The modules that use it wrap it in their own
 * rules — the agenda reports an appointment it cannot see as not found, the
 * till refuses to record someone else's sale — because the answer is the same
 * but the consequence is not.
 */
@Injectable()
export class StaffScope {
  constructor(private readonly staff: StaffRepository) {}

  async forActor(actor: AuthContext): Promise<StaffScopeResult> {
    if (actor.role !== UserRole.Staff) {
      return { kind: 'all' };
    }

    return { kind: 'own', staffMemberId: await this.staffMemberOf(actor) };
  }

  /**
   * The staff member linked to this account, whatever the role: an OWNER who
   * also cuts hair has an agenda and figures of their own.
   */
  async staffMemberOf(actor: AuthContext): Promise<string | null> {
    const own = await this.staff.findByUserId(actor.tenantId, actor.userId);

    return own?.id ?? null;
  }
}
