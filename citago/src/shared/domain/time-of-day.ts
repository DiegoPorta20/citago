import { DomainError, DomainErrorCategory } from './domain-error.js';

export class InvalidTimeOfDayError extends DomainError {
  readonly code = 'INVALID_TIME_OF_DAY';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    super('A time of day must be HH:mm between 00:00 and 23:59.');
  }
}

const PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(:00)?$/;
const MINUTES_PER_HOUR = 60;

export class TimeOfDay {
  private constructor(readonly minutes: number) {}

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

  toString(): string {
    return `${String(this.hour).padStart(2, '0')}:${String(this.minute).padStart(2, '0')}`;
  }
}
