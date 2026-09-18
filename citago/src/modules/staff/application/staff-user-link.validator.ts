import { Injectable } from '@nestjs/common';

import { MembershipRepository } from '../../identity/domain/membership.repository.js';
import {
  UserAlreadyLinkedToStaffError,
  UserNotMemberOfTenantError,
} from '../domain/staff.errors.js';
import { StaffRepository } from '../domain/staff.repository.js';

/**
 * Checks that an account may be linked to a staff member.
 *
 * Shared by create and update so the two rules cannot drift apart:
 * - the user must have an **active membership in this tenant** — otherwise a
 *   business could attach someone else's account to its staff;
 * - one account maps to at most one staff member per business.
 *
 * The database backs both: `(tenant_id, user_id)` references `memberships` and
 * is unique on `staff_members`.
 */
@Injectable()
export class StaffUserLinkValidator {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly staff: StaffRepository,
  ) {}

  async assertLinkable(
    tenantId: string,
    userId: string,
    staffMemberId?: string,
  ): Promise<void> {
    const membership = await this.memberships.findByTenantAndUser(
      tenantId,
      userId,
    );

    if (!membership?.isActive) {
      throw new UserNotMemberOfTenantError();
    }

    const linked = await this.staff.findByUserId(tenantId, userId);

    if (linked && linked.id !== staffMemberId) {
      throw new UserAlreadyLinkedToStaffError();
    }
  }
}
