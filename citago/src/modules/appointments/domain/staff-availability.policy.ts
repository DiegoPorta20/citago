import type { BusinessCalendar } from '../../../shared/domain/business-calendar.js';
import { TimeRange } from '../../../shared/domain/time-range.js';
import type { StaffTimeOff } from '../../staff/domain/staff-time-off.entity.js';
import type { WeeklySchedule } from '../../../shared/domain/weekly-schedule.js';
import {
  AppointmentSpansDaysError,
  OutsideStaffScheduleError,
  StaffOnTimeOffError,
} from './appointment.errors.js';

export interface AvailabilityContext {
  readonly calendar: BusinessCalendar;
  readonly schedule: WeeklySchedule;
  readonly timeOff: readonly StaffTimeOff[];
}

export interface FreeSlotsInput extends AvailabilityContext {
  readonly localDate: string;
  readonly durationMinutes: number;
  /** Appointments that occupy the staff member's time that day. */
  readonly busy: readonly TimeRange[];
  /** Slots starting before this instant are not offered (the past). */
  readonly notBefore: Date;
  readonly stepMinutes: number;
}

export interface FreeSlot {
  readonly startAt: Date;
  readonly endAt: Date;
}

/**
 * Whether a staff member is available, according to their weekly schedule and
 * their time off, evaluated in the business's wall clock.
 *
 * The weekly schedule is local time ("09:00–13:00") and is turned into
 * instants for the specific date, so daylight-saving changes are handled by
 * the calendar, not by this code.
 */
export const StaffAvailabilityPolicy = {
  /**
   * An appointment starts and ends on the same local day. Applies always,
   * even when an OWNER books outside working hours: a haircut from 23:30 to
   * 00:15 is a data-entry error and would make "the agenda of a day" ambiguous.
   */
  assertWithinOneDay(range: TimeRange, calendar: BusinessCalendar): void {
    const lastInstant = new Date(range.end.getTime() - 1);

    if (
      calendar.localDateOf(lastInstant) !== calendar.localDateOf(range.start)
    ) {
      throw new AppointmentSpansDaysError();
    }
  },

  /** Throws unless the whole range fits one working range and no time off. */
  assertAvailable(range: TimeRange, context: AvailabilityContext): void {
    StaffAvailabilityPolicy.assertWithinOneDay(range, context.calendar);

    const localDate = context.calendar.localDateOf(range.start);

    const fits = workingRanges(localDate, context).some((working) =>
      working.contains(range),
    );

    if (!fits) {
      throw new OutsideStaffScheduleError();
    }

    if (context.timeOff.some((off) => off.range.overlaps(range))) {
      throw new StaffOnTimeOffError();
    }
  },

  /**
   * Every start time on a local date where a service of `durationMinutes`
   * fits: inside a working range, outside time off, not overlapping a busy
   * appointment, and not in the past.
   *
   * Candidates are aligned to `stepMinutes` from the start of each working
   * range, so a shift starting 09:00 offers 09:00, 09:15, 09:30…
   */
  freeSlots(input: FreeSlotsInput): FreeSlot[] {
    const durationMs = input.durationMinutes * 60_000;
    const stepMs = input.stepMinutes * 60_000;
    const slots: FreeSlot[] = [];

    for (const working of workingRanges(input.localDate, input)) {
      for (
        let start = working.start.getTime();
        start + durationMs <= working.end.getTime();
        start += stepMs
      ) {
        if (start < input.notBefore.getTime()) {
          continue;
        }

        const candidate = TimeRange.of(
          new Date(start),
          new Date(start + durationMs),
        );

        const blocked =
          input.busy.some((busy) => busy.overlaps(candidate)) ||
          input.timeOff.some((off) => off.range.overlaps(candidate));

        if (!blocked) {
          slots.push({ startAt: candidate.start, endAt: candidate.end });
        }
      }
    }

    return slots;
  },
};

function workingRanges(
  localDate: string,
  context: AvailabilityContext,
): TimeRange[] {
  const weekday = context.calendar.weekdayOf(localDate);

  return context.schedule
    .rangesFor(weekday)
    .map((range) =>
      context.calendar.rangeOn(localDate, range.startsAt, range.endsAt),
    );
}
