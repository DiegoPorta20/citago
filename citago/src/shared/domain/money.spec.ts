import { InvalidMoneyError, Money } from './money.js';

describe('Money', () => {
  describe('parsing', () => {
    it.each([
      ['25.00', 2500n],
      ['25.5', 2550n],
      ['25', 2500n],
      ['0', 0n],
      ['0.05', 5n],
      [' 30.00 ', 3000n],
    ])('parses %s as %s cents', (value, cents) => {
      expect(Money.fromDecimalString(value).cents).toBe(cents);
    });

    it.each([
      ['a negative amount', '-5.00'],
      ['three decimals', '25.005'],
      ['a thousands separator', '1,000.00'],
      ['a currency symbol', 'S/ 25.00'],
      ['empty', ''],
      ['not a number', 'gratis'],
      ['scientific notation', '2.5e2'],
    ])('rejects %s', (_case, value) => {
      expect(() => Money.fromDecimalString(value)).toThrow(InvalidMoneyError);
    });

    it('accepts the largest amount DECIMAL(12,2) can hold', () => {
      expect(Money.fromDecimalString('9999999999.99').cents).toBe(
        999_999_999_999n,
      );
    });

    it('rejects an amount beyond DECIMAL(12,2)', () => {
      expect(() => Money.fromDecimalString('99999999999.00')).toThrow(
        InvalidMoneyError,
      );
    });

    it('rejects an addition that would overflow the column', () => {
      const max = Money.fromDecimalString('9999999999.99');

      expect(() => max.add(Money.fromCents(1n))).toThrow(InvalidMoneyError);
    });
  });

  describe('formatting', () => {
    it.each([
      [2500n, '25.00'],
      [2550n, '25.50'],
      [5n, '0.05'],
      [0n, '0.00'],
      [100000n, '1000.00'],
    ])('formats %s cents as %s', (cents, expected) => {
      expect(Money.fromCents(cents).toDecimalString()).toBe(expected);
    });

    it('round-trips through the wire format', () => {
      const original = '1234.56';

      expect(Money.fromDecimalString(original).toDecimalString()).toBe(
        original,
      );
    });
  });

  describe('arithmetic', () => {
    it('adds without floating point drift', () => {
      // The classic failure: 0.1 + 0.2 !== 0.3 with numbers.
      const total = Money.fromDecimalString('0.10').add(
        Money.fromDecimalString('0.20'),
      );

      expect(total.toDecimalString()).toBe('0.30');
    });

    it('adds a long list of prices exactly', () => {
      const prices = Array.from({ length: 300 }, () =>
        Money.fromDecimalString('0.07'),
      );

      const total = prices.reduce((sum, price) => sum.add(price), Money.zero());

      expect(total.toDecimalString()).toBe('21.00');
    });

    it('subtracts a discount', () => {
      const total = Money.fromDecimalString('35.00').subtract(
        Money.fromDecimalString('5.50'),
      );

      expect(total.toDecimalString()).toBe('29.50');
    });

    it('refuses to go negative', () => {
      // A discount larger than the subtotal is a bug, not a value.
      expect(() =>
        Money.fromDecimalString('10.00').subtract(
          Money.fromDecimalString('10.01'),
        ),
      ).toThrow(InvalidMoneyError);
    });

    it('multiplies by a quantity', () => {
      expect(
        Money.fromDecimalString('12.50').multiply(3).toDecimalString(),
      ).toBe('37.50');
    });

    it.each([[1.5], [-1]])('rejects the quantity %s', (quantity) => {
      expect(() => Money.fromDecimalString('10.00').multiply(quantity)).toThrow(
        InvalidMoneyError,
      );
    });

    it('multiplying by zero yields zero', () => {
      expect(Money.fromDecimalString('10.00').multiply(0).isZero()).toBe(true);
    });
  });

  describe('comparison', () => {
    it('compares by value, not by identity', () => {
      expect(
        Money.fromDecimalString('25.00').equals(Money.fromCents(2500n)),
      ).toBe(true);
      expect(
        Money.fromDecimalString('25.00').isGreaterThan(
          Money.fromDecimalString('24.99'),
        ),
      ).toBe(true);
    });
  });
});
