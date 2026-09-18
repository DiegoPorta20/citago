import { Money } from '../../../shared/domain/money.js';
import { TimeRange } from '../../../shared/domain/time-range.js';
import {
  CancellationReasonRequiredError,
  InvalidAppointmentDataError,
  InvalidAppointmentTransitionError,
  NoShowBeforeStartError,
  NotReschedulableError,
} from './appointment.errors.js';
import { type AppointmentSource } from './appointment-source.js';
import {
  ALLOWED_TRANSITIONS,
  AppointmentStatus,
  isBlocking,
  RESCHEDULABLE_STATUSES,
} from './appointment-status.js';

const MAX_NOTES_LENGTH = 500;
const MAX_REASON_LENGTH = 255;

/** One entry of the audit trail (decision F5): who moved it, when, and why. */
export interface AppointmentStatusChange {
  readonly fromStatus: AppointmentStatus | null;
  readonly toStatus: AppointmentStatus;
  readonly reason: string | null;
  readonly changedByUserId: string | null;
  readonly changedAt: Date;
}

export interface AppointmentSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly clientId: string;
  readonly serviceId: string;
  readonly staffMemberId: string;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly status: AppointmentStatus;
  /** Decimal string: the price agreed when booking, never the current one. */
  readonly price: string;
  readonly notes: string | null;
  readonly source: AppointmentSource;
  readonly createdByUserId: string | null;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly cancellationReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface BookAppointmentInput {
  readonly id: string;
  readonly tenantId: string;
  readonly clientId: string;
  readonly serviceId: string;
  readonly staffMemberId: string;
  readonly range: TimeRange;
  readonly price: Money;
  readonly notes?: string | null;
  readonly source: AppointmentSource;
  readonly initialStatus:
    AppointmentStatus.Pending | AppointmentStatus.Confirmed;
  /** Null when the system created it (e.g. from a WhatsApp message). */
  readonly createdByUserId: string | null;
}

/**
 * A booked service: a client, a staff member and a time.
 *
 * Owns the state machine and the snapshots that keep history true:
 * - `price` is copied from the service when booking (rule AP-2);
 * - the duration is fixed by `startAt`/`endAt`, so a later change to the
 *   service's duration does not move existing appointments (rule AP-1).
 *
 * What it does **not** decide is whether it collides with other appointments:
 * that needs to look at other rows, so it lives in `AppointmentOverlapPolicy`.
 */
export class Appointment {
  private readonly pendingChanges: AppointmentStatusChange[] = [];

  private constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly clientId: string,
    readonly serviceId: string,
    private _staffMemberId: string,
    private _range: TimeRange,
    private _status: AppointmentStatus,
    readonly price: Money,
    private _notes: string | null,
    readonly source: AppointmentSource,
    readonly createdByUserId: string | null,
    private _completedAt: Date | null,
    private _cancelledAt: Date | null,
    private _cancellationReason: string | null,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static book(input: BookAppointmentInput, now: Date): Appointment {
    const appointment = new Appointment(
      input.id,
      input.tenantId,
      input.clientId,
      input.serviceId,
      input.staffMemberId,
      input.range,
      input.initialStatus,
      input.price,
      assertNotes(input.notes ?? null),
      input.source,
      input.createdByUserId,
      null,
      null,
      null,
      now,
      now,
    );

    appointment.pendingChanges.push({
      fromStatus: null,
      toStatus: input.initialStatus,
      reason: null,
      changedByUserId: input.createdByUserId,
      changedAt: now,
    });

    return appointment;
  }

  static restore(snapshot: AppointmentSnapshot): Appointment {
    return new Appointment(
      snapshot.id,
      snapshot.tenantId,
      snapshot.clientId,
      snapshot.serviceId,
      snapshot.staffMemberId,
      TimeRange.of(snapshot.startAt, snapshot.endAt),
      snapshot.status,
      Money.fromDecimalString(snapshot.price),
      snapshot.notes,
      snapshot.source,
      snapshot.createdByUserId,
      snapshot.completedAt,
      snapshot.cancelledAt,
      snapshot.cancellationReason,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get staffMemberId(): string {
    return this._staffMemberId;
  }

  get range(): TimeRange {
    return this._range;
  }

  get status(): AppointmentStatus {
    return this._status;
  }

  get notes(): string | null {
    return this._notes;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }

  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  get cancellationReason(): string | null {
    return this._cancellationReason;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Whether this appointment occupies its staff member's time (rule AP-4). */
  get isBlocking(): boolean {
    return isBlocking(this._status);
  }

  canTransitionTo(target: AppointmentStatus): boolean {
    return ALLOWED_TRANSITIONS[this._status].includes(target);
  }

  /**
   * Moves the appointment through its lifecycle.
   *
   * Callers must check overlaps first when `target` blocks and the current
   * status does not (`NO_SHOW → COMPLETED`): the slot may have been given to
   * someone else meanwhile.
   */
  transitionTo(
    target: AppointmentStatus,
    context: {
      readonly actorUserId: string | null;
      readonly reason?: string | null;
    },
    now: Date,
  ): void {
    if (!this.canTransitionTo(target)) {
      throw new InvalidAppointmentTransitionError(this._status, target);
    }

    const reason = assertReason(context.reason ?? null);

    if (
      target === AppointmentStatus.Cancelled &&
      this._status === AppointmentStatus.InProgress &&
      !reason
    ) {
      // Stopping a service halfway is unusual enough to need an explanation.
      throw new CancellationReasonRequiredError();
    }

    if (
      target === AppointmentStatus.NoShow &&
      now.getTime() < this._range.start.getTime()
    ) {
      throw new NoShowBeforeStartError();
    }

    this.pendingChanges.push({
      fromStatus: this._status,
      toStatus: target,
      reason,
      changedByUserId: context.actorUserId,
      changedAt: now,
    });

    this._status = target;
    this._updatedAt = now;

    if (target === AppointmentStatus.Completed) {
      this._completedAt = now;
    }
    if (target === AppointmentStatus.Cancelled) {
      this._cancelledAt = now;
      this._cancellationReason = reason;
    }
  }

  /**
   * Moves the appointment to another time and/or staff member, keeping its
   * duration and its price. Callers must re-check overlaps and the schedule.
   */
  reschedule(
    changes: { readonly startAt?: Date; readonly staffMemberId?: string },
    now: Date,
  ): void {
    if (!RESCHEDULABLE_STATUSES.has(this._status)) {
      throw new NotReschedulableError(this._status);
    }

    if (changes.startAt) {
      const durationMs =
        this._range.end.getTime() - this._range.start.getTime();

      this._range = TimeRange.of(
        changes.startAt,
        new Date(changes.startAt.getTime() + durationMs),
      );
    }
    if (changes.staffMemberId) {
      this._staffMemberId = changes.staffMemberId;
    }

    this._updatedAt = now;
  }

  changeNotes(notes: string | null, now: Date): void {
    this._notes = assertNotes(notes);
    this._updatedAt = now;
  }

  /** Hands the new audit entries to the repository, exactly once. */
  pullStatusChanges(): AppointmentStatusChange[] {
    return this.pendingChanges.splice(0, this.pendingChanges.length);
  }

  toSnapshot(): AppointmentSnapshot {
    return {
      id: this.id,
      tenantId: this.tenantId,
      clientId: this.clientId,
      serviceId: this.serviceId,
      staffMemberId: this._staffMemberId,
      startAt: this._range.start,
      endAt: this._range.end,
      status: this._status,
      price: this.price.toDecimalString(),
      notes: this._notes,
      source: this.source,
      createdByUserId: this.createdByUserId,
      completedAt: this._completedAt,
      cancelledAt: this._cancelledAt,
      cancellationReason: this._cancellationReason,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

function assertNotes(notes: string | null): string | null {
  const trimmed = notes?.trim() || null;

  if (trimmed && trimmed.length > MAX_NOTES_LENGTH) {
    throw new InvalidAppointmentDataError(
      'notes',
      `they cannot exceed ${MAX_NOTES_LENGTH} characters`,
    );
  }

  return trimmed;
}

function assertReason(reason: string | null): string | null {
  const trimmed = reason?.trim() || null;

  if (trimmed && trimmed.length > MAX_REASON_LENGTH) {
    throw new InvalidAppointmentDataError(
      'reason',
      `it cannot exceed ${MAX_REASON_LENGTH} characters`,
    );
  }

  return trimmed;
}
