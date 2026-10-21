import 'package:citagof/core/utils/money_format.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('formatMoney', () {
    test('groups thousands and keeps two decimals', () {
      expect(formatMoney('1820.5', 'PEN'), 'S/ 1,820.50');
      expect(formatMoney('1234567.89', 'USD'), 'US\$ 1,234,567.89');
    });

    test('pads whole amounts', () {
      expect(formatMoney('0', 'PEN'), 'S/ 0.00');
      expect(formatMoney('25.00', 'PEN'), 'S/ 25.00');
    });

    test('keeps the sign', () {
      expect(formatMoney('-12.30', 'PEN'), '-S/ 12.30');
    });

    test('falls back to the ISO code for unknown currencies', () {
      expect(formatMoney('10.00', 'XYZ'), 'XYZ 10.00');
    });
  });
}
