import type { TimeRange } from '../../../shared/domain/time-range.js';
import type { StaffMember } from './staff-member.entity.js';
import type { StaffTimeOff } from './staff-time-off.entity.js';

export abstract class StaffRepository {
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<StaffMember | null>;

  abstract findManyByIdsForTenant(
    ids: readonly string[],
    tenantId: string,
  ): Promise<StaffMember[]>;

  abstract findByUserId(
    tenantId: string,
    userId: string,
  ): Promise<StaffMember | null>;

  abstract list(tenantId: string): Promise<StaffMember[]>;

  abstract save(staffMember: StaffMember): Promise<void>;

  abstract findTimeOffForTenant(
    id: string,
    tenantId: string,
  ): Promise<StaffTimeOff | null>;

  abstract listTimeOff(
    tenantId: string,
    staffMemberId: string,
    range: TimeRange,
  ): Promise<StaffTimeOff[]>;

  abstract saveTimeOff(timeOff: StaffTimeOff): Promise<void>;

  abstract deleteTimeOff(id: string, tenantId: string): Promise<void>;
}
