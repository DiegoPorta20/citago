import type { TimeRange } from '../../../shared/domain/time-range.js';
import { AppointmentOverlapError } from './appointment.errors.js';
import type { Appointment } from './appointment.entity.js';

/**
 * "A staff member cannot have two active appointments that overlap" (rule AP-3).
 *
 * Pure: it only looks at the appointments it is given. The caller is
 * responsible for passing **every** appointment of that staff member around the
 * candidate time, read **after** locking the staff member's agenda — otherwise
 * two simultaneous bookings could both pass this check.
 *
 * Which statuses count as "active" is decided here, by `isBlocking`, not by the
 * query: the rule lives in the domain, where it is tested.
 */
export const AppointmentOverlapPolicy = {
  assertNoOverlap(
    candidate: TimeRange,
    existing: readonly Appointment[],
    ignoreAppointmentId?: string,
  ): void {
    const conflict = existing.find(
      (appointment) =>
        appointment.id !== ignoreAppointmentId &&
        appointment.isBlocking &&
        appointment.range.overlaps(candidate),
    );

    if (conflict) {
      throw new AppointmentOverlapError(conflict.id);
    }
  },
};
