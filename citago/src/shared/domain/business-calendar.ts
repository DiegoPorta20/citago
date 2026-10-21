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

export class BusinessCalendar {
  constructor(readonly timezone: string) {}

  localDateOf(instant: Date): string {
    return this.inZone(instant).toISODate() as string;
  }

  localTimeOf(instant: Date): string {
    return this.inZone(instant).toFormat('HH:mm');
  }

  weekdayOf(localDate: string): number {
    return this.parseDate(localDate).weekday;
  }

  instantAt(localDate: string, time: TimeOfDay): Date {
    return this.parseDate(localDate)
      .set({ hour: time.hour, minute: time.minute, second: 0, millisecond: 0 })
      .toJSDate();
  }

  rangeOn(localDate: string, from: TimeOfDay, to: TimeOfDay): TimeRange {
    return TimeRange.of(
      this.instantAt(localDate, from),
      this.instantAt(localDate, to),
    );
  }

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
