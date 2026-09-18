import { DomainError, DomainErrorCategory } from './domain-error.js';

export class InvalidTimeOfDayError extends DomainError {
  readonly code = 'INVALID_TIME_OF_DAY';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    super('A time of day must be HH:mm between 00:00 and 23:59.');
  }
}

/** `09:00`, and also `09:00:00` as MySQL returns TIME columns. */
const PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(:00)?$/;
const MINUTES_PER_HOUR = 60;

/**
 * A wall-clock time with no date and no time zone: "we open at 09:00".
 *
 * Opening hours are stored like this on purpose (rule TZ-3). "09:00" must stay
 * 09:00 when daylight saving time changes, which a UTC instant would not.
 */
export class TimeOfDay {
  private constructor(
    /** Minutes since midnight, 0–1439. */
    readonly minutes: number,
  ) {}

  static parse(value: string): TimeOfDay {
    const match = PATTERN.exec(value.trim());

    if (!match) {
      throw new InvalidTimeOfDayError();
    }

    return new TimeOfDay(
      Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]),
    );
  }

  get hour(): number {
    return Math.floor(this.minutes / MINUTES_PER_HOUR);
  }

  get minute(): number {
    return this.minutes % MINUTES_PER_HOUR;
  }

  isBefore(other: TimeOfDay): boolean {
    return this.minutes < other.minutes;
  }

  equals(other: TimeOfDay): boolean {
    return this.minutes === other.minutes;
  }

  /** `HH:mm`, the wire and display format. */
  toString(): string {
    return `${String(this.hour).padStart(2, '0')}:${String(this.minute).padStart(2, '0')}`;
  }
}
