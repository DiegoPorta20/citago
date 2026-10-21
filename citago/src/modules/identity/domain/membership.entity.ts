import type { UserRole } from '../../../shared/domain/user-role.js';
import { MembershipStatus } from './membership-status.js';

export interface MembershipSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly role: UserRole;
  readonly status: MembershipStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Membership {
  private constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly userId: string,
    private _role: UserRole,
    private _status: MembershipStatus,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(
    input: {
      readonly id: string;
      readonly tenantId: string;
      readonly userId: string;
      readonly role: UserRole;
    },
    now: Date,
  ): Membership {
    return new Membership(
      input.id,
      input.tenantId,
      input.userId,
      input.role,
      MembershipStatus.Active,
      now,
      now,
    );
  }

  static restore(snapshot: MembershipSnapshot): Membership {
    return new Membership(
      snapshot.id,
      snapshot.tenantId,
      snapshot.userId,
      snapshot.role,
      snapshot.status,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get role(): UserRole {
    return this._role;
  }

  get status(): MembershipStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isActive(): boolean {
    return this._status === MembershipStatus.Active;
  }

  changeRole(role: UserRole, now: Date): void {
    this._role = role;
    this._updatedAt = now;
  }

  deactivate(now: Date): void {
    this._status = MembershipStatus.Inactive;
    this._updatedAt = now;
  }

  activate(now: Date): void {
    this._status = MembershipStatus.Active;
    this._updatedAt = now;
  }

  toSnapshot(): MembershipSnapshot {
    return {
      id: this.id,
      tenantId: this.tenantId,
      userId: this.userId,
      role: this._role,
      status: this._status,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
