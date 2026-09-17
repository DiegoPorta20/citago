import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';
import { Email } from '../../../shared/domain/email.js';

const MAX_NAME_LENGTH = 120;

export class InvalidUserNameError extends DomainError {
  readonly code = 'INVALID_USER_NAME';
  readonly category = DomainErrorCategory.Validation;

  constructor(reason: string) {
    super(`Invalid user name: ${reason}`);
  }
}

export interface UserSnapshot {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A person who can sign in.
 *
 * Platform-wide, not owned by a tenant: access to a business is a membership.
 * The entity only ever holds the password **hash** — the plain value stops at
 * the use case that hashed it.
 */
export class User {
  private constructor(
    readonly id: string,
    readonly email: Email,
    private _passwordHash: string,
    private _name: string,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(
    input: {
      readonly id: string;
      readonly email: Email;
      readonly passwordHash: string;
      readonly name: string;
    },
    now: Date,
  ): User {
    return new User(
      input.id,
      input.email,
      input.passwordHash,
      assertName(input.name),
      now,
      now,
    );
  }

  static restore(snapshot: UserSnapshot): User {
    return new User(
      snapshot.id,
      Email.create(snapshot.email),
      snapshot.passwordHash,
      snapshot.name,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get name(): string {
    return this._name;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  rename(name: string, now: Date): void {
    this._name = assertName(name);
    this._updatedAt = now;
  }

  changePassword(passwordHash: string, now: Date): void {
    this._passwordHash = passwordHash;
    this._updatedAt = now;
  }

  toSnapshot(): UserSnapshot {
    return {
      id: this.id,
      email: this.email.value,
      passwordHash: this._passwordHash,
      name: this._name,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

function assertName(name: string): string {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    throw new InvalidUserNameError('it cannot be empty');
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new InvalidUserNameError(
      `it cannot exceed ${MAX_NAME_LENGTH} characters`,
    );
  }

  return trimmed;
}
