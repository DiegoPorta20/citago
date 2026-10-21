import type { TimeRange } from '../../../shared/domain/time-range.js';
import { AppointmentOverlapError } from './appointment.errors.js';
import type { Appointment } from './appointment.entity.js';

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
