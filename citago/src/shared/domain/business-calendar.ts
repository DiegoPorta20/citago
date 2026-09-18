import { DateTime } from 'luxon';

import { DomainError, DomainErrorCategory } from './domain-error.js';
import type { TimeOfDay } from './time-of-day.js';
import { TimeRange } from './time-range.js';

export class InvalidLocalDateError extends DomainError {
  readonly code = 'INVALID_LOCAL_DATE';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    super('A date must be a real calendar day in the form YYYY-MM-DD.');
  }
}

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts between the business's wall clock and UTC instants.
 *
 * Every rule that talks about "a day" or "09:00" is evaluated here, in the
 * **business time zone**, never the server's or the phone's (rule TZ-2).
 *
 * `luxon` lives in the domain for the same reason as `libphonenumber-js`: it is
 * pure computation over the IANA database, and daylight-saving transitions are
 * exactly the kind of logic that must not be hand-rolled.
 */
export class BusinessCalendar {
  constructor(readonly timezone: string) {}

  /** The local calendar day an instant falls on, as `YYYY-MM-DD`. */
  localDateOf(instant: Date): string {
    return this.inZone(instant).toISODate() as string;
  }

  /** The local wall-clock time of an instant, as `HH:mm`. */
  localTimeOf(instant: Date): string {
    return this.inZone(instant).toFormat('HH:mm');
  }

  /** ISO weekday of a local date: 1 = Monday … 7 = Sunday. */
  weekdayOf(localDate: string): number {
    return this.parseDate(localDate).weekday;
  }

  /**
   * The instant a wall-clock time happens on a local date.
   *
   * A time that does not exist (skipped by a daylight-saving jump) moves
   * forward, as a clock on the wall would.
   */
  instantAt(localDate: string, time: TimeOfDay): Date {
    return this.parseDate(localDate)
      .set({ hour: time.hour, minute: time.minute, second: 0, millisecond: 0 })
      .toJSDate();
  }

  /** A wall-clock range on a local date, as instants. */
  rangeOn(localDate: string, from: TimeOfDay, to: TimeOfDay): TimeRange {
    return TimeRange.of(
      this.instantAt(localDate, from),
      this.instantAt(localDate, to),
    );
  }

  /** The whole local day, `[00:00, next day 00:00)`. Not always 24 hours long. */
  dayRange(localDate: string): TimeRange {
    const start = this.parseDate(localDate).startOf('day');

    return TimeRange.of(start.toJSDate(), start.plus({ days: 1 }).toJSDate());
  }

  private parseDate(localDate: string): DateTime {
    if (!LOCAL_DATE_PATTERN.test(localDate)) {
      throw new InvalidLocalDateError();
    }

    const date = DateTime.fromISO(localDate, { zone: this.timezone });

    if (!date.isValid) {
      throw new InvalidLocalDateError();
    }

    return date;
  }

  private inZone(instant: Date): DateTime {
    return DateTime.fromJSDate(instant, { zone: this.timezone });
  }
}
