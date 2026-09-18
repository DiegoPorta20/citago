import type { TimeRange } from '../../../shared/domain/time-range.js';
import type { StaffMember } from './staff-member.entity.js';
import type { StaffTimeOff } from './staff-time-off.entity.js';

/**
 * Persistence contract for staff members, their weekly schedule and their time
 * off. The schedule is saved together with its staff member (same aggregate).
 *
 * **Every method takes `tenantId`** (see docs/adr/0004-tenant-isolation.md).
 *
 * No pagination on `list`: a business has a handful of staff members, and the
 * agenda needs all of them at once.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class StaffRepository {
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<StaffMember | null>;

  /** Batch lookup for views that show many appointments at once. */
  abstract findManyByIdsForTenant(
    ids: readonly string[],
    tenantId: string,
  ): Promise<StaffMember[]>;

  /** How a STAFF user finds "their" staff member. */
  abstract findByUserId(
    tenantId: string,
    userId: string,
  ): Promise<StaffMember | null>;

  abstract list(tenantId: string): Promise<StaffMember[]>;

  /** Persists the staff member and replaces its weekly schedule. */
  abstract save(staffMember: StaffMember): Promise<void>;

  abstract findTimeOffForTenant(
    id: string,
    tenantId: string,
  ): Promise<StaffTimeOff | null>;

  /** Time off of one staff member that overlaps the given range. */
  abstract listTimeOff(
    tenantId: string,
    staffMemberId: string,
    range: TimeRange,
  ): Promise<StaffTimeOff[]>;

  abstract saveTimeOff(timeOff: StaffTimeOff): Promise<void>;

  abstract deleteTimeOff(id: string, tenantId: string): Promise<void>;
}
