import 'package:citagof/features/sales/data/models/sale_model.dart';
import 'package:citagof/features/sales/domain/entities/sale.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('saleFromJson', () {
    test('parses a paid sale with lines', () {
      final sale = saleFromJson({
        'id': 'sale1',
        'status': 'PAID',
        'currency': 'PEN',
        'subtotal': '25.00',
        'discount': '5.00',
        'total': '20.00',
        'paymentMethod': 'CARD',
        'soldAt': '2026-10-20T15:00:00.000Z',
        'paidAt': '2026-10-20T15:00:00.000Z',
        'voidedAt': null,
        'voidReason': null,
        'appointmentId': 'a1',
        'client': {'id': 'c1', 'name': 'Ana'},
        'staffMember': {'id': 'm1', 'name': 'Carlos'},
        'lines': [
          {
            'id': 'l1',
            'serviceId': 's1',
            'description': 'Corte',
            'unitPrice': '25.00',
            'quantity': 1,
            'lineTotal': '25.00',
          },
        ],
      });

      expect(sale.status, SaleStatus.paid);
      expect(sale.paymentMethod, PaymentMethod.card);
      expect(sale.total, '20.00');
      expect(sale.lines.single.description, 'Corte');
      expect(sale.lines.single.quantity, 1);
    });

    test('parses a pending sale without a payment method', () {
      final sale = saleFromJson({
        'id': 'sale2',
        'status': 'PENDING',
        'currency': 'PEN',
        'subtotal': '25.00',
        'discount': '0.00',
        'total': '25.00',
        'paymentMethod': null,
        'soldAt': '2026-10-20T15:00:00.000Z',
        'paidAt': null,
        'voidedAt': null,
        'voidReason': null,
        'appointmentId': 'a1',
        'client': null,
        'staffMember': null,
        'lines': [],
      });

      expect(sale.status, SaleStatus.pending);
      expect(sale.paymentMethod, isNull);
    });
  });

  group('registerSaleBody', () {
    test('omits a zero discount and includes the payment method', () {
      final body = registerSaleBody(
        const RegisterSaleInput(
          appointmentId: 'a1',
          discount: '0.00',
          paymentMethod: PaymentMethod.cash,
        ),
      );
      expect(body['appointmentId'], 'a1');
      expect(body.containsKey('discount'), isFalse);
      expect(body['paymentMethod'], 'CASH');
    });

    test('includes a non-zero discount and omits a missing method', () {
      final body = registerSaleBody(
        const RegisterSaleInput(appointmentId: 'a1', discount: '5.00'),
      );
      expect(body['discount'], '5.00');
      expect(body.containsKey('paymentMethod'), isFalse);
    });
  });

  group('payment method labels', () {
    test('each method has a Spanish label and round-trips', () {
      for (final method in PaymentMethod.values) {
        expect(method.label, isNotEmpty);
        expect(PaymentMethod.parse(method.wire), method);
      }
    });
  });
}
