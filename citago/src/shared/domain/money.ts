import { DomainError, DomainErrorCategory } from './domain-error.js';

export class InvalidMoneyError extends DomainError {
  readonly code = 'INVALID_MONEY';
  readonly category = DomainErrorCategory.Validation;

  constructor(reason: string) {
    super(`Invalid amount: ${reason}`);
  }
}

const DECIMAL_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

const MAX_CENTS = 999_999_999_999n;
const SCALE = 100n;

export class Money {
  private constructor(readonly cents: bigint) {}

  static zero(): Money {
    return new Money(0n);
  }

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

  toDecimalString(): string {
    const units = this.cents / SCALE;
    const decimals = this.cents % SCALE;

    return `${units}.${decimals.toString().padStart(2, '0')}`;
  }

  add(other: Money): Money {
    return Money.fromCents(this.cents + other.cents);
  }

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
