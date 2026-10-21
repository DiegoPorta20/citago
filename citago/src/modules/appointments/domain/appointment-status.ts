export enum AppointmentStatus {
  Pending = 'PENDING',
  Confirmed = 'CONFIRMED',
  Arrived = 'ARRIVED',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
  NoShow = 'NO_SHOW',
}

export const BLOCKING_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  AppointmentStatus.Pending,
  AppointmentStatus.Confirmed,
  AppointmentStatus.Arrived,
  AppointmentStatus.InProgress,
  AppointmentStatus.Completed,
]);

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

export const RESCHEDULABLE_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  AppointmentStatus.Pending,
  AppointmentStatus.Confirmed,
]);

export function isBlocking(status: AppointmentStatus): boolean {
  return BLOCKING_STATUSES.has(status);
}
