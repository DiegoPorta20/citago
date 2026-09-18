import { TimeRange } from '../../../shared/domain/time-range.js';
import { InvalidTimeOffError } from './staff.errors.js';

const MAX_REASON_LENGTH = 255;
/** A year: longer than that is not time off, it is leaving the business. */
const MAX_DURATION_DAYS = 366;

export interface StaffTimeOffSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly staffMemberId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly reason: string | null;
  readonly createdAt: Date;
}

/**
 * A period when a staff member does not take bookings, on top of their weekly
 * schedule: holidays, a sick day, an afternoon off.
 *
 * Stored as UTC instants, not local dates: "Monday afternoon" and "the whole
 * week" are both just ranges, and the app decides how to present them.
 */
export class StaffTimeOff {
  private constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly staffMemberId: string,
    readonly range: TimeRange,
    readonly reason: string | null,
    readonly createdAt: Date,
  ) {}

  static create(
    input: {
      readonly id: string;
      readonly tenantId: string;
      readonly staffMemberId: string;
      readonly startsAt: Date;
      readonly endsAt: Date;
      readonly reason?: string | null;
    },
    now: Date,
  ): StaffTimeOff {
    if (input.endsAt.getTime() <= input.startsAt.getTime()) {
      throw new InvalidTimeOffError('it must end after it starts');
    }

    const days =
      (input.endsAt.getTime() - input.startsAt.getTime()) / 86_400_000;

    if (days > MAX_DURATION_DAYS) {
      throw new InvalidTimeOffError(
        `it cannot last more than ${MAX_DURATION_DAYS} days`,
      );
    }

    const reason = input.reason?.trim() || null;

    if (reason && reason.length > MAX_REASON_LENGTH) {
      throw new InvalidTimeOffError(
        `the reason cannot exceed ${MAX_REASON_LENGTH} characters`,
      );
    }

    return new StaffTimeOff(
      input.id,
      input.tenantId,
      input.staffMemberId,
      TimeRange.of(input.startsAt, input.endsAt),
      reason,
      now,
    );
  }

  static restore(snapshot: StaffTimeOffSnapshot): StaffTimeOff {
    return new StaffTimeOff(
      snapshot.id,
      snapshot.tenantId,
      snapshot.staffMemberId,
      TimeRange.of(snapshot.startsAt, snapshot.endsAt),
      snapshot.reason,
      snapshot.createdAt,
    );
  }

  toSnapshot(): StaffTimeOffSnapshot {
    return {
      id: this.id,
      tenantId: this.tenantId,
      staffMemberId: this.staffMemberId,
      startsAt: this.range.start,
      endsAt: this.range.end,
      reason: this.reason,
      createdAt: this.createdAt,
    };
  }
}
