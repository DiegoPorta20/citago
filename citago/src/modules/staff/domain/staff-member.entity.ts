import { InvalidStaffDataError } from './staff.errors.js';
import { StaffMemberStatus } from './staff-member-status.js';
import { WeeklySchedule } from '../../../shared/domain/weekly-schedule.js';

const MAX_NAME_LENGTH = 120;

export interface StaffMemberSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string | null;
  readonly displayName: string;
  readonly status: StaffMemberStatus;
  readonly schedule: WeeklySchedule;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class StaffMember {
  private constructor(
    readonly id: string,
    readonly tenantId: string,
    private _userId: string | null,
    private _displayName: string,
    private _status: StaffMemberStatus,
    private _schedule: WeeklySchedule,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(
    input: {
      readonly id: string;
      readonly tenantId: string;
      readonly displayName: string;
      readonly userId?: string | null;
    },
    now: Date,
  ): StaffMember {
    return new StaffMember(
      input.id,
      input.tenantId,
      input.userId ?? null,
      assertName(input.displayName),
      StaffMemberStatus.Active,
      WeeklySchedule.empty(),
      now,
      now,
    );
  }

  static restore(snapshot: StaffMemberSnapshot): StaffMember {
    return new StaffMember(
      snapshot.id,
      snapshot.tenantId,
      snapshot.userId,
      snapshot.displayName,
      snapshot.status,
      snapshot.schedule,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get userId(): string | null {
    return this._userId;
  }

  get displayName(): string {
    return this._displayName;
  }

  get status(): StaffMemberStatus {
    return this._status;
  }

  get schedule(): WeeklySchedule {
    return this._schedule;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isActive(): boolean {
    return this._status === StaffMemberStatus.Active;
  }

  rename(displayName: string, now: Date): void {
    this._displayName = assertName(displayName);
    this._updatedAt = now;
  }

  linkUser(userId: string | null, now: Date): void {
    this._userId = userId;
    this._updatedAt = now;
  }

  replaceSchedule(schedule: WeeklySchedule, now: Date): void {
    this._schedule = schedule;
    this._updatedAt = now;
  }

  activate(now: Date): void {
    if (!this.isActive) {
      this._status = StaffMemberStatus.Active;
      this._updatedAt = now;
    }
  }

  deactivate(now: Date): void {
    if (this.isActive) {
      this._status = StaffMemberStatus.Inactive;
      this._updatedAt = now;
    }
  }

  toSnapshot(): StaffMemberSnapshot {
    return {
      id: this.id,
      tenantId: this.tenantId,
      userId: this._userId,
      displayName: this._displayName,
      status: this._status,
      schedule: this._schedule,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

function assertName(name: string): string {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    throw new InvalidStaffDataError('displayName', 'it cannot be empty');
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new InvalidStaffDataError(
      'displayName',
      `it cannot exceed ${MAX_NAME_LENGTH} characters`,
    );
  }

  return trimmed;
}
