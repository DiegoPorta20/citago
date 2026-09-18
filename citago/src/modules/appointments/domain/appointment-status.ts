export enum AppointmentStatus {
  /** Booked, not yet confirmed — typical of a WhatsApp request. */
  Pending = 'PENDING',
  /** Agreed with the client. */
  Confirmed = 'CONFIRMED',
  /** The client is in the shop, waiting. */
  Arrived = 'ARRIVED',
  /** Being served right now. */
  InProgress = 'IN_PROGRESS',
  /** Served. */
  Completed = 'COMPLETED',
  /** Will not happen. */
  Cancelled = 'CANCELLED',
  /** The client did not come. */
  NoShow = 'NO_SHOW',
}

/**
 * Statuses that occupy the staff member's time (rule AP-4).
 *
 * `COMPLETED` blocks on purpose (decision F8): a completed appointment used real
 * time, and letting another booking overlap it would create two physically
 * impossible records. `CANCELLED` and `NO_SHOW` free the slot — the barber
 * could serve someone else.
 */
export const BLOCKING_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  AppointmentStatus.Pending,
  AppointmentStatus.Confirmed,
  AppointmentStatus.Arrived,
  AppointmentStatus.InProgress,
  AppointmentStatus.Completed,
]);

/**
 * The state machine (rules AP-6 and AP-7).
 *
 * - `ARRIVED` and `IN_PROGRESS` are optional steps: a busy barber completes in
 *   one tap from `PENDING` or `CONFIRMED` (decision F9).
 * - `NO_SHOW → COMPLETED` covers the client who arrived late after being marked
 *   absent (decision F7).
 * - `COMPLETED` and `CANCELLED` are terminal. A client who wants another time
 *   gets a new appointment; the cancelled one stays as history.
 */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<AppointmentStatus, readonly AppointmentStatus[]>
> = {
  [AppointmentStatus.Pending]: [
    AppointmentStatus.Confirmed,
    AppointmentStatus.Arrived,
    AppointmentStatus.InProgress,
    AppointmentStatus.Completed,
    AppointmentStatus.Cancelled,
    AppointmentStatus.NoShow,
  ],
  [AppointmentStatus.Confirmed]: [
    AppointmentStatus.Arrived,
    AppointmentStatus.InProgress,
    AppointmentStatus.Completed,
    AppointmentStatus.Cancelled,
    AppointmentStatus.NoShow,
  ],
  // Once the client is in the shop, "did not come" is a contradiction.
  [AppointmentStatus.Arrived]: [
    AppointmentStatus.InProgress,
    AppointmentStatus.Completed,
    AppointmentStatus.Cancelled,
  ],
  [AppointmentStatus.InProgress]: [
    AppointmentStatus.Completed,
    AppointmentStatus.Cancelled,
  ],
  [AppointmentStatus.NoShow]: [AppointmentStatus.Completed],
  [AppointmentStatus.Completed]: [],
  [AppointmentStatus.Cancelled]: [],
};

/** Only these can move to another time or another staff member. */
export const RESCHEDULABLE_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  AppointmentStatus.Pending,
  AppointmentStatus.Confirmed,
]);

export function isBlocking(status: AppointmentStatus): boolean {
  return BLOCKING_STATUSES.has(status);
}
