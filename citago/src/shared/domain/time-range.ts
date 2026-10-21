import { DomainError, DomainErrorCategory } from './domain-error.js';

export class InvalidTimeRangeError extends DomainError {
  readonly code = 'INVALID_TIME_RANGE';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    super('A time range must end after it starts.');
  }
}

export class TimeRange {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static of(start: Date, end: Date): TimeRange {
    if (end.getTime() <= start.getTime()) {
      throw new InvalidTimeRangeError();
    }

    return new TimeRange(start, end);
  }

  get durationMinutes(): number {
    return (this.end.getTime() - this.start.getTime()) / 60_000;
  }

  overlaps(other: TimeRange): boolean {
    return (
      this.start.getTime() < other.end.getTime() &&
      other.start.getTime() < this.end.getTime()
    );
  }

  contains(other: TimeRange): boolean {
    return (
      this.start.getTime() <= other.start.getTime() &&
      other.end.getTime() <= this.end.getTime()
    );
  }
}
