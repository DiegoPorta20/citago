import { Injectable } from '@nestjs/common';

import { MembershipRepository } from '../../identity/domain/membership.repository.js';
import {
  UserAlreadyLinkedToStaffError,
  UserNotMemberOfTenantError,
} from '../domain/staff.errors.js';
import { StaffRepository } from '../domain/staff.repository.js';

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
