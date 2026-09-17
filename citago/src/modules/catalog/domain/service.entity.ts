import { Money } from '../../../shared/domain/money.js';
import { InvalidServiceDataError } from './errors/catalog.errors.js';
import { ServiceStatus } from './service-status.js';

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
/** Twelve hours: anything longer is a data-entry mistake, not a haircut. */
const MAX_DURATION_MINUTES = 720;

export interface ServiceSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number;
  /** Decimal string, exactly as stored in DECIMAL(12,2). */
  readonly price: string;
  readonly status: ServiceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateServiceInput {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly durationMinutes: number;
  readonly price: Money;
}

export interface UpdateServiceInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly durationMinutes?: number;
  readonly price?: Money;
}

/**
 * Something the business sells and schedules: a haircut, a beard trim.
 *
 * Two of its fields drive the agenda and the money, so they are validated here
 * and not only at the HTTP boundary:
 * - `durationMinutes` decides when an appointment ends and therefore what
 *   overlaps with what.
 * - `price` is copied onto every appointment as a snapshot, so a price change
 *   never rewrites history.
 */
export class Service {
  private constructor(
    readonly id: string,
    readonly tenantId: string,
    private _name: string,
    private _description: string | null,
    private _durationMinutes: number,
    private _price: Money,
    private _status: ServiceStatus,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(input: CreateServiceInput, now: Date): Service {
    return new Service(
      input.id,
      input.tenantId,
      assertName(input.name),
      assertDescription(input.description ?? null),
      assertDuration(input.durationMinutes),
      input.price,
      ServiceStatus.Active,
      now,
      now,
    );
  }

  static restore(snapshot: ServiceSnapshot): Service {
    return new Service(
      snapshot.id,
      snapshot.tenantId,
      snapshot.name,
      snapshot.description,
      snapshot.durationMinutes,
      Money.fromDecimalString(snapshot.price),
      snapshot.status,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get name(): string {
    return this._name;
  }

  get description(): string | null {
    return this._description;
  }

  get durationMinutes(): number {
    return this._durationMinutes;
  }

  get price(): Money {
    return this._price;
  }

  get status(): ServiceStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isActive(): boolean {
    return this._status === ServiceStatus.Active;
  }

  /** Applies only the fields provided; the rest keep their value. */
  update(changes: UpdateServiceInput, now: Date): void {
    if (changes.name !== undefined) {
      this._name = assertName(changes.name);
    }
    if (changes.description !== undefined) {
      this._description = assertDescription(changes.description);
    }
    if (changes.durationMinutes !== undefined) {
      this._durationMinutes = assertDuration(changes.durationMinutes);
    }
    if (changes.price !== undefined) {
      this._price = changes.price;
    }

    this._updatedAt = now;
  }

  /**
   * Both transitions are idempotent: activating an active service is a no-op,
   * so a retried request is harmless.
   */
  activate(now: Date): void {
    if (this._status === ServiceStatus.Active) {
      return;
    }

    this._status = ServiceStatus.Active;
    this._updatedAt = now;
  }

  /**
   * Takes the service out of the catalogue without touching history: past
   * appointments keep pointing at it (rule CA-3), new ones cannot use it
   * (rule CA-4).
   */
  deactivate(now: Date): void {
    if (this._status === ServiceStatus.Inactive) {
      return;
    }

    this._status = ServiceStatus.Inactive;
    this._updatedAt = now;
  }

  toSnapshot(): ServiceSnapshot {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this._name,
      description: this._description,
      durationMinutes: this._durationMinutes,
      price: this._price.toDecimalString(),
      status: this._status,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

function assertName(name: string): string {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    throw new InvalidServiceDataError('name', 'it cannot be empty');
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new InvalidServiceDataError(
      'name',
      `it cannot exceed ${MAX_NAME_LENGTH} characters`,
    );
  }

  return trimmed;
}

function assertDescription(description: string | null): string | null {
  if (description === null) {
    return null;
  }

  const trimmed = description.trim();

  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new InvalidServiceDataError(
      'description',
      `it cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }

  return trimmed;
}

function assertDuration(durationMinutes: number): number {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new InvalidServiceDataError(
      'duration',
      'it must be a positive whole number of minutes',
    );
  }
  if (durationMinutes > MAX_DURATION_MINUTES) {
    throw new InvalidServiceDataError(
      'duration',
      `it cannot exceed ${MAX_DURATION_MINUTES} minutes`,
    );
  }

  return durationMinutes;
}
