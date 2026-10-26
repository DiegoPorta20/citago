import type { TimeRange } from '../../../src/shared/domain/time-range.js';
import type { StaffMember } from '../../../src/modules/staff/domain/staff-member.entity.js';
import type { StaffTimeOff } from '../../../src/modules/staff/domain/staff-time-off.entity.js';
import { StaffRepository } from '../../../src/modules/staff/domain/staff.repository.js';
import { StaffMemberStatus } from '../../../src/modules/staff/domain/staff-member-status.js';

/** Only what the member use cases touch; time off is not needed here. */
export class InMemoryStaffRepository extends StaffRepository {
  readonly members = new Map<string, StaffMember>();

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<StaffMember | null> {
    const member = this.members.get(id);

    return member && member.tenantId === tenantId ? member : null;
  }

  async findManyByIdsForTenant(
    ids: readonly string[],
    tenantId: string,
  ): Promise<StaffMember[]> {
    return [...this.members.values()].filter(
      (member) => member.tenantId === tenantId && ids.includes(member.id),
    );
  }

  async findByUserId(
    tenantId: string,
    userId: string,
  ): Promise<StaffMember | null> {
    return (
      [...this.members.values()].find(
        (member) => member.tenantId === tenantId && member.userId === userId,
      ) ?? null
    );
  }

  async list(tenantId: string): Promise<StaffMember[]> {
    return [...this.members.values()].filter(
      (member) => member.tenantId === tenantId,
    );
  }

  async countActive(tenantId: string): Promise<number> {
    return [...this.members.values()].filter(
      (member) =>
        member.tenantId === tenantId &&
        member.status === StaffMemberStatus.Active,
    ).length;
  }

  async save(member: StaffMember): Promise<void> {
    this.members.set(member.id, member);
  }

  async findTimeOffForTenant(): Promise<StaffTimeOff | null> {
    return null;
  }

  async listTimeOff(
    _tenantId: string,
    _staffMemberId: string,
    _range: TimeRange,
  ): Promise<StaffTimeOff[]> {
    return [];
  }

  async saveTimeOff(): Promise<void> {}

  async deleteTimeOff(): Promise<void> {}
}
