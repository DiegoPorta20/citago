import { DomainError, DomainErrorCategory } from './domain-error.js';

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    // The offending value is never echoed back or logged.
    super('The email address is not valid.');
  }
}

const MAX_LENGTH = 160;

/**
 * Pragmatic shape check. Full RFC 5322 validation is famously useless in
 * practice: what proves an address real is sending mail to it.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * An email address, normalized once so that `Ana@Demo.local` and
 * `ana@demo.local` can never become two accounts.
 */
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
