import 'package:citagof/features/sales/data/models/sale_model.dart';
import 'package:citagof/features/sales/domain/entities/money.dart';
import 'package:citagof/features/sales/domain/entities/sale.dart';
import 'package:citagof/features/sales/presentation/providers/sale_providers.dart';
import 'package:flutter_test/flutter_test.dart';

Sale _sale({required SaleStatus status, String total = '20.00'}) => Sale(
  id: 's-${status.wire}',
  status: status,
  currency: 'PEN',
  subtotal: total,
  discount: '0.00',
  total: total,
  lines: const [],
);

void main() {
  group('saleFromJson audit fields', () {
    test('parses the snapshot, refs and audit instants', () {
      final sale = saleFromJson({
        'id': 'sale1',
        'status': 'REFUNDED',
        'currency': 'PEN',
        'subtotal': '25.00',
        'discount': '5.00',
        'total': '20.00',
        'paymentMethod': 'CARD',
        'soldAt': '2026-10-20T15:00:00.000Z',
        'paidAt': '2026-10-20T15:05:00.000Z',
        'voidedAt': '2026-10-20T16:00:00.000Z',
        'voidReason': 'Cliente se arrepintió',
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

      expect(sale.status, SaleStatus.refunded);
      expect(sale.soldAt, DateTime.utc(2026, 10, 20, 15));
      expect(sale.paidAt, DateTime.utc(2026, 10, 20, 15, 5));
      expect(sale.voidedAt, DateTime.utc(2026, 10, 20, 16));
      expect(sale.voidReason, 'Cliente se arrepintió');
      expect(sale.appointmentId, 'a1');
      expect(sale.client?.name, 'Ana');
      expect(sale.staffMember?.name, 'Carlos');
      expect(sale.lines.single.unitPrice, '25.00');
    });

    test('keeps null audit fields null on a pending counter sale', () {
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
        'appointmentId': null,
        'client': null,
        'staffMember': null,
        'lines': [],
      });

      expect(sale.paidAt, isNull);
      expect(sale.voidedAt, isNull);
      expect(sale.client, isNull);
      expect(sale.appointmentId, isNull);
    });
  });

  group('voidSaleBody', () {
    test('trims the reason', () {
      expect(voidSaleBody('  motivo  '), {'reason': 'motivo'});
    });
  });

  group('action availability by status', () {
    test('PENDING can be paid and cancelled, not refunded', () {
      final sale = _sale(status: SaleStatus.pending);
      expect(sale.canPay, isTrue);
      expect(sale.canCancel, isTrue);
      expect(sale.canRefund, isFalse);
    });

    test('PAID can be refunded, not paid or cancelled', () {
      final sale = _sale(status: SaleStatus.paid);
      expect(sale.canPay, isFalse);
      expect(sale.canCancel, isFalse);
      expect(sale.canRefund, isTrue);
    });

    test('CANCELLED and REFUNDED are terminal', () {
      for (final status in [SaleStatus.cancelled, SaleStatus.refunded]) {
        final sale = _sale(status: status);
        expect(sale.canPay, isFalse);
        expect(sale.canCancel, isFalse);
        expect(sale.canRefund, isFalse);
      }
    });

    test('voiding requires managing the business', () {
      expect(Sale.canManage(true), isTrue);
      expect(Sale.canManage(false), isFalse);
    });
  });

  group('summary sums in cents', () {
    test('adds only PAID totals, using integer cents', () {
      final state = SalesListState(
        items: [
          _sale(status: SaleStatus.paid, total: '20.10'),
          _sale(status: SaleStatus.paid, total: '0.20'),
          _sale(status: SaleStatus.pending, total: '99.99'),
          _sale(status: SaleStatus.cancelled, total: '50.00'),
          _sale(status: SaleStatus.refunded, total: '30.00'),
        ],
        hasMore: false,
        total: 5,
      );

      expect(state.paidCents, 2030);
      expect(state.paidCents, Money.parse('20.30').cents);
      expect(state.paidTotal, '20.30');
    });

    test('is zero when nothing is paid', () {
      final state = SalesListState(
        items: [_sale(status: SaleStatus.pending, total: '10.00')],
        hasMore: false,
        total: 1,
      );
      expect(state.paidCents, 0);
      expect(state.paidTotal, '0.00');
    });
  });

  group('status filter wire values', () {
    test('each filter maps to the backend status (or null for all)', () {
      expect(SalesStatusFilter.all.status, isNull);
      expect(SalesStatusFilter.paid.status, SaleStatus.paid);
      expect(SalesStatusFilter.pending.status, SaleStatus.pending);
      expect(SalesStatusFilter.cancelled.status, SaleStatus.cancelled);
      expect(SalesStatusFilter.refunded.status, SaleStatus.refunded);
    });
  });
}
