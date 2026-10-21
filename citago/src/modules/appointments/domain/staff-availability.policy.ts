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
  readonly busy: readonly TimeRange[];
  readonly notBefore: Date;
  readonly stepMinutes: number;
}

export interface FreeSlot {
  readonly startAt: Date;
  readonly endAt: Date;
}

export const StaffAvailabilityPolicy = {
  assertWithinOneDay(range: TimeRange, calendar: BusinessCalendar): void {
    const lastInstant = new Date(range.end.getTime() - 1);

    if (
      calendar.localDateOf(lastInstant) !== calendar.localDateOf(range.start)
    ) {
      throw new AppointmentSpansDaysError();
    }
  },

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
