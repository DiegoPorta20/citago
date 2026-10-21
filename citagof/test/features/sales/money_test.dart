import 'package:citagof/features/sales/domain/entities/money.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Money.parse', () {
    test('parses whole, one-decimal and two-decimal strings', () {
      expect(Money.parse('25').cents, 2500);
      expect(Money.parse('25.5').cents, 2550);
      expect(Money.parse('1820.50').cents, 182050);
      expect(Money.parse('0').cents, 0);
    });

    test('parses negative amounts', () {
      expect(Money.parse('-5.00').cents, -500);
    });

    test('rejects more than two decimals and junk', () {
      expect(() => Money.parse('1.234'), throwsFormatException);
      expect(() => Money.parse('abc'), throwsFormatException);
      expect(() => Money.parse(''), throwsFormatException);
    });

    test('tryParse returns null on invalid input', () {
      expect(Money.tryParse('1.234'), isNull);
      expect(Money.tryParse('10.00'), const Money(1000));
    });
  });

  group('arithmetic (integer cents, never doubles)', () {
    test('subtract keeps exact cents where doubles would drift', () {
      final result =
          Money.parse('0.10') + Money.parse('0.20') - Money.parse('0.30');
      expect(result.cents, 0);
      expect(result.isZero, isTrue);
    });

    test('multiply by a quantity', () {
      expect((Money.parse('25.00') * 3).cents, 7500);
    });

    test('comparisons', () {
      expect(Money.parse('5.00') > Money.parse('4.99'), isTrue);
      expect(Money.parse('5.00') <= Money.parse('5.00'), isTrue);
      expect(Money.parse('5.00').isNegative, isFalse);
      expect(Money.parse('-0.01').isNegative, isTrue);
    });
  });

  group('toDecimalString', () {
    test('always has two decimals', () {
      expect(Money.parse('25').toDecimalString(), '25.00');
      expect(Money.parse('25.5').toDecimalString(), '25.50');
      expect(const Money(182050).toDecimalString(), '1820.50');
      expect(const Money(-500).toDecimalString(), '-5.00');
    });
  });

  group('discount against subtotal (rule SA-2)', () {
    test('a discount above the subtotal is detected with cents math', () {
      final subtotal = Money.parse('20.00');
      final discount = Money.parse('25.00');
      expect(discount > subtotal, isTrue);
      final total = subtotal - discount;
      expect(total.isNegative, isTrue);
    });

    test('a valid discount yields the right total', () {
      final subtotal = Money.parse('20.00');
      final discount = Money.parse('5.50');
      expect(discount <= subtotal, isTrue);
      expect((subtotal - discount).toDecimalString(), '14.50');
    });
  });
}
