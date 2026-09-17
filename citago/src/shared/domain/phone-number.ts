import { parsePhoneNumberWithError } from 'libphonenumber-js';

import { DomainError, DomainErrorCategory } from './domain-error.js';

export class InvalidPhoneNumberError extends DomainError {
  readonly code = 'INVALID_PHONE_NUMBER';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    // The offending value is never echoed back: it is personal data.
    super('The phone number is not valid.');
  }
}

/**
 * A phone number in E.164, the one canonical form.
 *
 * This matters more than it looks: WhatsApp identifies a customer by their
 * number, so `999 999 999`, `+51 999 999 999` and `051999999999` must all
 * resolve to the same client or the same person ends up duplicated
 * (rules CL-1 and CL-2).
 *
 * `libphonenumber-js` lives in the domain on purpose: it is a pure, offline
 * data library, like a date or decimal library. Hiding it behind a port would
 * leave this value object unable to validate its own invariant.
 */
export class PhoneNumber {
  private constructor(
    /** E.164, e.g. `+51999999999`. */
    readonly value: string,
    /** ISO 3166-1 alpha-2 the number resolved to, when known. */
    readonly country: string | undefined,
  ) {}

  /**
   * Parses what a person typed.
   *
   * `defaultCountry` is the tenant's country, so a local number entered without
   * a prefix still normalizes correctly.
   */
  static create(raw: string, defaultCountry: string): PhoneNumber {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidPhoneNumberError();
    }

    try {
      const parsed = parsePhoneNumberWithError(trimmed, {
        defaultCountry: defaultCountry as never,
      });

      // A number can parse and still be impossible for its country.
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

  /**
   * Rebuilds a number already stored, which was validated when it was written.
   *
   * Re-validating here would make a row unreadable if the phone metadata of a
   * country ever changes, and an unreadable customer is worse than an
   * out-of-date format.
   */
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
