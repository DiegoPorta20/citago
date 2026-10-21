import { DomainError, DomainErrorCategory } from './domain-error.js';
import { TimeOfDay } from './time-of-day.js';

export class InvalidScheduleError extends DomainError {
  readonly code = 'INVALID_SCHEDULE';
  readonly category = DomainErrorCategory.Validation;

  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Invalid weekly schedule: ${reason}`, details);
  }
}

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ScheduleRange {
  readonly weekday: Weekday;
  readonly startsAt: TimeOfDay;
  readonly endsAt: TimeOfDay;
}

export interface ScheduleRangeInput {
  readonly weekday: number;
  readonly startsAt: string;
  readonly endsAt: string;
}

const MAX_RANGES_PER_DAY = 4;

export class WeeklySchedule {
  private constructor(private readonly ranges: readonly ScheduleRange[]) {}

  static empty(): WeeklySchedule {
    return new WeeklySchedule([]);
  }

  static fromInput(input: readonly ScheduleRangeInput[]): WeeklySchedule {
    const ranges = input.map((range) => ({
      weekday: assertWeekday(range.weekday),
      startsAt: TimeOfDay.parse(range.startsAt),
      endsAt: TimeOfDay.parse(range.endsAt),
    }));

    for (const range of ranges) {
      if (!range.startsAt.isBefore(range.endsAt)) {
        throw new InvalidScheduleError('each range must end after it starts', {
          weekday: range.weekday,
        });
      }
    }

    for (let weekday = 1; weekday <= 7; weekday += 1) {
      const day = ranges
        .filter((range) => range.weekday === weekday)
        .sort((a, b) => a.startsAt.minutes - b.startsAt.minutes);

      if (day.length > MAX_RANGES_PER_DAY) {
        throw new InvalidScheduleError(
          `at most ${MAX_RANGES_PER_DAY} ranges per day`,
          { weekday },
        );
      }

      for (let index = 1; index < day.length; index += 1) {
        if (day[index].startsAt.isBefore(day[index - 1].endsAt)) {
          throw new InvalidScheduleError('ranges on the same day overlap', {
            weekday,
          });
        }
      }
    }

    return new WeeklySchedule(
      [...ranges].sort(
        (a, b) =>
          a.weekday - b.weekday || a.startsAt.minutes - b.startsAt.minutes,
      ),
    );
  }

  static restore(ranges: readonly ScheduleRange[]): WeeklySchedule {
    return new WeeklySchedule(ranges);
  }

  rangesFor(weekday: number): readonly ScheduleRange[] {
    return this.ranges.filter((range) => range.weekday === weekday);
  }

  all(): readonly ScheduleRange[] {
    return this.ranges;
  }

  get isEmpty(): boolean {
    return this.ranges.length === 0;
  }
}

function assertWeekday(value: number): Weekday {
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    throw new InvalidScheduleError('weekday must be 1 (Monday) to 7 (Sunday)');
  }

  return value as Weekday;
}
