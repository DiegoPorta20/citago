import { Email } from '../../../shared/domain/email.js';
import { PhoneNumber } from '../../../shared/domain/phone-number.js';
import {
  ClientAlreadyDeletedError,
  InvalidClientDataError,
} from './errors/clients.errors.js';

const MAX_NAME_LENGTH = 120;
const MAX_NOTES_LENGTH = 2000;

export interface ClientSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  /** E.164, or null for a walk-in nobody asked a number from. */
  readonly phoneE164: string | null;
  readonly email: string | null;
  readonly notes: string | null;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateClientInput {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly phone?: PhoneNumber | null;
  readonly email?: Email | null;
  readonly notes?: string | null;
}

export interface UpdateClientInput {
  readonly name?: string;
  readonly phone?: PhoneNumber | null;
  readonly email?: Email | null;
  readonly notes?: string | null;
}

/**
 * The end customer of a business.
 *
 * The phone is **optional**: a walk-in can be registered with a name alone. It
 * is also how WhatsApp identifies the person, so when present it is unique
 * within the tenant (rule CL-2) and always stored in E.164.
 *
 * Clients are never hard-deleted (rule CL-3): appointments and sales must keep
 * pointing at a real person.
 *
 * `totalVisits` and `totalSpent` are deliberately **not** fields here: they are
 * computed from appointments and sales (rule CL-5), because denormalized
 * counters drift the first time a sale is voided.
 */
export class Client {
  private constructor(
    readonly id: string,
    readonly tenantId: string,
    private _name: string,
    private _phone: PhoneNumber | null,
    private _email: Email | null,
    private _notes: string | null,
    private _deletedAt: Date | null,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(input: CreateClientInput, now: Date): Client {
    return new Client(
      input.id,
      input.tenantId,
      assertName(input.name),
      input.phone ?? null,
      input.email ?? null,
      assertNotes(input.notes ?? null),
      null,
      now,
      now,
    );
  }

  static restore(snapshot: ClientSnapshot): Client {
    return new Client(
      snapshot.id,
      snapshot.tenantId,
      snapshot.name,
      snapshot.phoneE164 ? PhoneNumber.fromE164(snapshot.phoneE164) : null,
      snapshot.email ? Email.create(snapshot.email) : null,
      snapshot.notes,
      snapshot.deletedAt,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get name(): string {
    return this._name;
  }

  get phone(): PhoneNumber | null {
    return this._phone;
  }

  get email(): Email | null {
    return this._email;
  }

  get notes(): string | null {
    return this._notes;
  }

  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  /** Applies only the fields provided; `null` clears an optional one. */
  update(changes: UpdateClientInput, now: Date): void {
    if (changes.name !== undefined) {
      this._name = assertName(changes.name);
    }
    if (changes.phone !== undefined) {
      this._phone = changes.phone;
    }
    if (changes.email !== undefined) {
      this._email = changes.email;
    }
    if (changes.notes !== undefined) {
      this._notes = assertNotes(changes.notes);
    }

    this._updatedAt = now;
  }

  /**
   * Soft delete: the row stays so its appointments and sales keep their
   * customer. The phone stays too, which is why re-registering it offers to
   * restore this client instead of creating a duplicate.
   */
  softDelete(now: Date): void {
    if (this.isDeleted) {
      throw new ClientAlreadyDeletedError();
    }

    this._deletedAt = now;
    this._updatedAt = now;
  }

  restore(now: Date): void {
    this._deletedAt = null;
    this._updatedAt = now;
  }

  toSnapshot(): ClientSnapshot {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this._name,
      phoneE164: this._phone?.value ?? null,
      email: this._email?.value ?? null,
      notes: this._notes,
      deletedAt: this._deletedAt,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

function assertName(name: string): string {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    throw new InvalidClientDataError('name', 'it cannot be empty');
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new InvalidClientDataError(
      'name',
      `it cannot exceed ${MAX_NAME_LENGTH} characters`,
    );
  }

  return trimmed;
}

function assertNotes(notes: string | null): string | null {
  if (notes === null) {
    return null;
  }

  const trimmed = notes.trim();

  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_NOTES_LENGTH) {
    throw new InvalidClientDataError(
      'notes',
      `they cannot exceed ${MAX_NOTES_LENGTH} characters`,
    );
  }

  return trimmed;
}
