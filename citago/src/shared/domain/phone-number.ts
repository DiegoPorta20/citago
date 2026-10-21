import { parsePhoneNumberWithError } from 'libphonenumber-js';

import { DomainError, DomainErrorCategory } from './domain-error.js';

export class InvalidPhoneNumberError extends DomainError {
  readonly code = 'INVALID_PHONE_NUMBER';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    super('The phone number is not valid.');
  }
}

export class PhoneNumber {
  private constructor(
    readonly value: string,
    readonly country: string | undefined,
  ) {}

  static create(raw: string, defaultCountry: string): PhoneNumber {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidPhoneNumberError();
    }

    try {
      const parsed = parsePhoneNumberWithError(trimmed, {
        defaultCountry: defaultCountry as never,
      });

      if (!parsed.isValid()) {
        throw new InvalidPhoneNumberError();
      }

      return new PhoneNumber(parsed.number, parsed.country);
    } catch (error) {
      if (error instanceof InvalidPhoneNumberError) {
        throw error;
      }

      throw new InvalidPhoneNumberError();
    }
  }

  static fromE164(stored: string): PhoneNumber {
    return new PhoneNumber(stored, undefined);
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
