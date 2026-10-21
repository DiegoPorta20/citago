import { DomainError, DomainErrorCategory } from './domain-error.js';

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    super('The email address is not valid.');
  }
}

const MAX_LENGTH = 160;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();

    if (normalized.length === 0 || normalized.length > MAX_LENGTH) {
      throw new InvalidEmailError();
    }

    if (!EMAIL_PATTERN.test(normalized)) {
      throw new InvalidEmailError();
    }

    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
