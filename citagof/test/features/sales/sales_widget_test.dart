import 'package:citagof/core/network/api_response.dart';
import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/sales/domain/entities/sale.dart';
import 'package:citagof/features/sales/domain/repositories/sale_repository.dart';
import 'package:citagof/features/sales/presentation/pages/sale_detail_page.dart';
import 'package:citagof/features/sales/presentation/pages/sales_page.dart';
import 'package:citagof/features/sales/presentation/providers/sale_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

final _fixedNow = DateTime.utc(2026, 10, 20, 14, 0);

AuthSession _session(UserRole role) => AuthSession(
  user: const SessionUser(id: 'u1', email: 'o@demo.local', name: 'Diego'),
  tenant: const SessionTenant(
    id: 't1',
    name: 'Barbería Demo',
    currency: 'PEN',
    timezone: 'America/Lima',
  ),
  role: role,
);

class _SignedIn extends SessionController {
  _SignedIn(this.role);
  final UserRole role;
  @override
  Future<AuthSession?> build() async => _session(role);
}

Sale _sale({
  required String id,
  SaleStatus status = SaleStatus.paid,
  String total = '20.00',
  SaleRef? client,
  DateTime? soldAt,
  List<SaleLine> lines = const [],
  PaymentMethod? paymentMethod = PaymentMethod.cash,
  String? appointmentId,
  DateTime? paidAt,
  DateTime? voidedAt,
  String? voidReason,
  SaleRef? staffMember,
}) => Sale(
  id: id,
  status: status,
  currency: 'PEN',
  subtotal: total,
  discount: '0.00',
  total: total,
  paymentMethod: paymentMethod,
  soldAt: soldAt ?? DateTime.utc(2026, 10, 20, 15),
  paidAt: paidAt,
  voidedAt: voidedAt,
  voidReason: voidReason,
  appointmentId: appointmentId,
  client: client,
  staffMember: staffMember,
  lines: lines,
);

class _FakeSales implements SaleRepository {
  _FakeSales(this.seed);

  final List<Sale> seed;

  DateTime? lastFrom;
  DateTime? lastTo;
  SaleStatus? lastStatus;
  final List<(String, PaymentMethod)> paid = [];
  final List<(String, String)> cancelled = [];
  final List<(String, String)> refunded = [];
  Sale? detail;

  @override
  Future<Paged<Sale>> list({
    required DateTime from,
    required DateTime to,
    SaleStatus? status,
    int page = 1,
    int limit = 20,
  }) async {
    lastFrom = from;
    lastTo = to;
    lastStatus = status;
    final items = status == null
        ? seed
        : seed.where((s) => s.status == status).toList();
    return Paged(
      items: items,
      page: page,
      limit: limit,
      total: items.length,
      totalPages: 1,
    );
  }

  @override
  Future<Sale> get(String id) async =>
      detail ?? seed.firstWhere((s) => s.id == id);

  @override
  Future<Sale> pay(String id, PaymentMethod method) async {
    paid.add((id, method));
    return _sale(id: id, status: SaleStatus.paid);
  }

  @override
  Future<Sale> cancel(String id, String reason) async {
    cancelled.add((id, reason));
    return _sale(id: id, status: SaleStatus.cancelled);
  }

  @override
  Future<Sale> refund(String id, String reason) async {
    refunded.add((id, reason));
    return _sale(id: id, status: SaleStatus.refunded);
  }

  @override
  Future<Sale> register(RegisterSaleInput input) => throw UnimplementedError();
}

Widget _app(Widget home, _FakeSales repo, {UserRole role = UserRole.owner}) {
  final router = GoRouter(
    initialLocation: '/',
    routes: [GoRoute(path: '/', builder: (_, _) => home)],
  );
  return ProviderScope(
    overrides: [
      sessionControllerProvider.overrideWith(() => _SignedIn(role)),
      businessClockProvider.overrideWithValue(
        BusinessClock('America/Lima', now: () => _fixedNow),
      ),
      saleRepositoryProvider.overrideWithValue(repo),
    ],
    child: MaterialApp.router(routerConfig: router),
  );
}

void main() {
  setUpAll(initializeBusinessTime);

  group('sales list', () {
    testWidgets('requests the business day as a UTC range', (tester) async {
      final repo = _FakeSales([
        _sale(
          id: 's1',
          client: const SaleRef(id: 'c1', name: 'Ana'),
        ),
      ]);
      await tester.pumpWidget(_app(const SalesPage(), repo));
      await tester.pumpAndSettle();

      expect(repo.lastFrom, DateTime.utc(2026, 10, 20, 5));
      expect(repo.lastTo, DateTime.utc(2026, 10, 21, 5));
      expect(repo.lastStatus, isNull);
      expect(find.text('Ana'), findsOneWidget);
    });

    testWidgets('summary shows count and the PAID total', (tester) async {
      final repo = _FakeSales([
        _sale(id: 's1', status: SaleStatus.paid, total: '20.00'),
        _sale(id: 's2', status: SaleStatus.pending, total: '99.00'),
      ]);
      await tester.pumpWidget(_app(const SalesPage(), repo));
      await tester.pumpAndSettle();

      expect(find.text('2'), findsOneWidget);
      expect(find.text('S/ 20.00'), findsNWidgets(2));
      expect(find.text('Cobrado'), findsOneWidget);
    });

    testWidgets('a filter chip passes the status to the API', (tester) async {
      final repo = _FakeSales([_sale(id: 's1', status: SaleStatus.pending)]);
      await tester.pumpWidget(_app(const SalesPage(), repo));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Pendientes'));
      await tester.pumpAndSettle();

      expect(repo.lastStatus, SaleStatus.pending);
    });

    testWidgets('shows the empty state when there are no sales', (
      tester,
    ) async {
      final repo = _FakeSales([]);
      await tester.pumpWidget(_app(const SalesPage(), repo));
      await tester.pumpAndSettle();

      expect(find.textContaining('No hay ventas'), findsOneWidget);
    });

    testWidgets('STAFF sees the own-sales note', (tester) async {
      final repo = _FakeSales([_sale(id: 's1')]);
      await tester.pumpWidget(
        _app(const SalesPage(), repo, role: UserRole.staff),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('tu atención'), findsOneWidget);
    });
  });

  group('sale detail', () {
    testWidgets('shows the line snapshots and totals', (tester) async {
      final repo = _FakeSales([])
        ..detail = _sale(
          id: 's1',
          status: SaleStatus.paid,
          total: '25.00',
          client: const SaleRef(id: 'c1', name: 'Ana'),
          staffMember: const SaleRef(id: 'm1', name: 'Carlos'),
          paidAt: DateTime.utc(2026, 10, 20, 15),
          lines: const [
            SaleLine(
              id: 'l1',
              description: 'Corte de cabello',
              unitPrice: '25.00',
              quantity: 1,
              lineTotal: '25.00',
            ),
          ],
        );
      await tester.pumpWidget(_app(const SaleDetailPage(saleId: 's1'), repo));
      await tester.pumpAndSettle();

      expect(find.text('Corte de cabello'), findsOneWidget);
      expect(find.textContaining('1 ×'), findsOneWidget);
      expect(find.text('Subtotal'), findsOneWidget);
      expect(find.text('Atendió: Carlos'), findsOneWidget);
    });

    testWidgets('paying a pending sale calls pay', (tester) async {
      final repo = _FakeSales([])
        ..detail = _sale(
          id: 's1',
          status: SaleStatus.pending,
          paymentMethod: null,
        );
      await tester.pumpWidget(_app(const SaleDetailPage(saleId: 's1'), repo));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(FilledButton, 'Cobrar'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Cobrar').last);
      await tester.pumpAndSettle();

      expect(repo.paid, [('s1', PaymentMethod.cash)]);
    });

    testWidgets('STAFF gets no cancel or refund on their sale', (tester) async {
      final repo = _FakeSales([])
        ..detail = _sale(id: 's1', status: SaleStatus.paid);
      await tester.pumpWidget(
        _app(const SaleDetailPage(saleId: 's1'), repo, role: UserRole.staff),
      );
      await tester.pumpAndSettle();

      expect(find.widgetWithText(OutlinedButton, 'Reembolsar'), findsNothing);
      expect(find.widgetWithText(OutlinedButton, 'Anular'), findsNothing);
    });

    testWidgets('an owner can cancel a pending sale with a reason', (
      tester,
    ) async {
      final repo = _FakeSales([])
        ..detail = _sale(
          id: 's1',
          status: SaleStatus.pending,
          paymentMethod: null,
        );
      await tester.pumpWidget(_app(const SaleDetailPage(saleId: 's1'), repo));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(OutlinedButton, 'Anular'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Cobro duplicado');
      await tester.tap(find.widgetWithText(FilledButton, 'Anular'));
      await tester.pumpAndSettle();

      expect(repo.cancelled, [('s1', 'Cobro duplicado')]);
    });

    testWidgets('refund requires a non-empty reason', (tester) async {
      final repo = _FakeSales([])
        ..detail = _sale(id: 's1', status: SaleStatus.paid);
      await tester.pumpWidget(_app(const SaleDetailPage(saleId: 's1'), repo));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(OutlinedButton, 'Reembolsar'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Reembolsar'));
      await tester.pumpAndSettle();

      expect(find.text('Indica el motivo.'), findsOneWidget);
      expect(repo.refunded, isEmpty);

      await tester.enterText(find.byType(TextField), 'Producto defectuoso');
      await tester.tap(find.widgetWithText(FilledButton, 'Reembolsar'));
      await tester.pumpAndSettle();

      expect(repo.refunded, [('s1', 'Producto defectuoso')]);
    });
  });
}
