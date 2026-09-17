import { DomainError, DomainErrorCategory } from './domain-error.js';

export class InvalidMoneyError extends DomainError {
  readonly code = 'INVALID_MONEY';
  readonly category = DomainErrorCategory.Validation;

  constructor(reason: string) {
    super(`Invalid amount: ${reason}`);
  }
}

/** Matches `0`, `25`, `25.5`, `25.50`. Rejects signs, spaces and more decimals. */
const DECIMAL_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * DECIMAL(12,2) holds 12 digits in total, two of them after the point, so the
 * largest storable amount is 9999999999.99 — that is 999999999999 cents.
 */
const MAX_CENTS = 999_999_999_999n;
const SCALE = 100n;

/**
 * A non-negative amount of money, held as an exact integer of cents.
 *
 * Never a `number`: `0.1 + 0.2` is not `0.3` in floating point, and prices,
 * discounts and revenue must add up to the cent. The currency is **not** part
 * of this value — every amount of a tenant is expressed in the tenant's
 * currency, and a sale stores that currency as a snapshot.
 */
export class Money {
  private constructor(readonly cents: bigint) {}

  static zero(): Money {
    return new Money(0n);
  }

  /**
   * Parses the wire format: a decimal **string**, as the API sends and receives
   * it (`"25.00"`). A JS number is rejected on purpose.
   */
  static fromDecimalString(value: string): Money {
    const trimmed = value.trim();

    if (!DECIMAL_PATTERN.test(trimmed)) {
      throw new InvalidMoneyError(
        'it must be a non-negative decimal with at most 2 decimal places, e.g. "25.00"',
      );
    }

    const [units, decimals = ''] = trimmed.split('.');
    const cents =
      BigInt(units) * SCALE + BigInt(decimals.padEnd(2, '0').slice(0, 2));

    return Money.fromCents(cents);
  }

  static fromCents(cents: bigint): Money {
    if (cents < 0n) {
      throw new InvalidMoneyError('it cannot be negative');
    }
    if (cents > MAX_CENTS) {
      throw new InvalidMoneyError('it exceeds the supported range');
    }

    return new Money(cents);
  }

  /** The format stored in DECIMAL(12,2) and sent over the API. */
  toDecimalString(): string {
    const units = this.cents / SCALE;
    const decimals = this.cents % SCALE;

    return `${units}.${decimals.toString().padStart(2, '0')}`;
  }

  add(other: Money): Money {
    return Money.fromCents(this.cents + other.cents);
  }

  /** Throws rather than going negative: an amount below zero is a bug, not a value. */
  subtract(other: Money): Money {
    return Money.fromCents(this.cents - other.cents);
  }

  multiply(quantity: number): Money {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new InvalidMoneyError('a quantity must be a non-negative integer');
    }

    return Money.fromCents(this.cents * BigInt(quantity));
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  isGreaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  toString(): string {
    return this.toDecimalString();
  }
}
