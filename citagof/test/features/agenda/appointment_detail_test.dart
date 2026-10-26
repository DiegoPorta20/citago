import 'package:citagof/core/network/api_response.dart';
import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/agenda/domain/entities/appointment.dart';
import 'package:citagof/features/agenda/domain/entities/appointment_status.dart';
import 'package:citagof/features/agenda/domain/entities/availability.dart';
import 'package:citagof/features/agenda/domain/repositories/appointment_repository.dart';
import 'package:citagof/features/agenda/presentation/pages/appointment_detail_page.dart';
import 'package:citagof/features/agenda/presentation/providers/agenda_providers.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/sales/domain/entities/sale.dart';
import 'package:citagof/features/sales/domain/repositories/sale_repository.dart';
import 'package:citagof/features/sales/presentation/providers/sale_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

AuthSession _session() => const AuthSession(
  user: SessionUser(id: 'u1', email: 'o@demo.local', name: 'Diego'),
  tenant: SessionTenant(
    id: 't1',
    name: 'Barbería Demo',
    currency: 'PEN',
    timezone: 'America/Lima',
  ),
  role: UserRole.owner,
);

class _SignedInSession extends SessionController {
  @override
  Future<AuthSession?> build() async => _session();
}

Appointment _appointment(AppointmentStatus status) => Appointment(
  id: 'a1',
  status: status,
  startAt: DateTime.utc(2026, 10, 20, 14),
  endAt: DateTime.utc(2026, 10, 20, 14, 30),
  price: '20.00',
  client: const NamedRef(id: 'c1', name: 'Ana'),
  service: const NamedRef(id: 's1', name: 'Corte'),
  staffMember: const NamedRef(id: 'm1', name: 'Carlos'),
);

class _FakeAppointments implements AppointmentRepository {
  _FakeAppointments(AppointmentStatus status) : current = _appointment(status);

  Appointment current;
  final List<AppointmentAction> transitions = [];

  @override
  Future<Appointment> get(String id) async => current;

  @override
  Future<Appointment> transition(
    String id,
    AppointmentAction action, {
    String? reason,
  }) async {
    transitions.add(action);
    return current = _appointment(action.target);
  }

  @override
  Future<List<Appointment>> agenda({
    required DateTime from,
    required DateTime to,
    String? staffMemberId,
  }) async => const [];

  @override
  Future<Availability> availability({
    required String staffMemberId,
    required String serviceId,
    required String date,
  }) => throw UnimplementedError();

  @override
  Future<Appointment> book(BookAppointmentInput input) =>
      throw UnimplementedError();

  @override
  Future<Appointment> reschedule(String id, RescheduleInput input) =>
      throw UnimplementedError();
}

class _FakeSales implements SaleRepository {
  _FakeSales([this.forAppointment]);

  final Sale? forAppointment;

  @override
  Future<Sale?> findByAppointment(String appointmentId) async => forAppointment;

  @override
  Future<Sale> register(RegisterSaleInput input) => throw UnimplementedError();

  @override
  Future<Paged<Sale>> list({
    required DateTime from,
    required DateTime to,
    SaleStatus? status,
    int page = 1,
    int limit = 20,
  }) => throw UnimplementedError();

  @override
  Future<Sale> get(String id) => throw UnimplementedError();

  @override
  Future<Sale> pay(String id, PaymentMethod method) =>
      throw UnimplementedError();

  @override
  Future<Sale> cancel(String id, String reason) => throw UnimplementedError();

  @override
  Future<Sale> refund(String id, String reason) => throw UnimplementedError();
}

Sale _sale(SaleStatus status) => Sale(
  id: 'sale1',
  status: status,
  currency: 'PEN',
  subtotal: '20.00',
  discount: '0.00',
  total: '20.00',
  appointmentId: 'a1',
  lines: const [],
);

Future<void> _pump(
  WidgetTester tester, {
  required _FakeAppointments appointments,
  _FakeSales? sales,
}) async {
  tester.view.physicalSize = const Size(800, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sessionControllerProvider.overrideWith(_SignedInSession.new),
        businessClockProvider.overrideWithValue(
          BusinessClock('America/Lima', now: () => DateTime.utc(2026, 10, 20)),
        ),
        appointmentRepositoryProvider.overrideWithValue(appointments),
        saleRepositoryProvider.overrideWithValue(sales ?? _FakeSales()),
      ],
      child: const MaterialApp(
        home: AppointmentDetailPage(appointmentId: 'a1'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  group('action buttons', () {
    testWidgets('the next step replaces the one just taken, with no spinner', (
      tester,
    ) async {
      final appointments = _FakeAppointments(AppointmentStatus.arrived);
      await _pump(tester, appointments: appointments);

      await tester.tap(find.widgetWithText(FilledButton, 'Iniciar'));
      await tester.pumpAndSettle();

      expect(appointments.transitions, [AppointmentAction.start]);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      final next = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Completar'),
      );
      expect(next.onPressed, isNotNull);
    });

    testWidgets('every step of the flow can be taken in a row', (tester) async {
      final appointments = _FakeAppointments(AppointmentStatus.pending);
      await _pump(tester, appointments: appointments);

      await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Marcar llegada'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Iniciar'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Completar'));
      await tester.pumpAndSettle();

      expect(appointments.transitions, [
        AppointmentAction.confirm,
        AppointmentAction.arrive,
        AppointmentAction.start,
        AppointmentAction.complete,
      ]);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });
  });

  group('charging', () {
    testWidgets('an unbilled appointment offers Cobrar', (tester) async {
      await _pump(
        tester,
        appointments: _FakeAppointments(AppointmentStatus.completed),
      );

      expect(find.text('Cobrar'), findsOneWidget);
    });

    testWidgets('a paid appointment no longer offers Cobrar', (tester) async {
      await _pump(
        tester,
        appointments: _FakeAppointments(AppointmentStatus.completed),
        sales: _FakeSales(_sale(SaleStatus.paid)),
      );

      expect(find.text('Cobrar'), findsNothing);
      expect(find.text('Ver venta (Pagada)'), findsOneWidget);
    });

    testWidgets('a sale left pending can still be charged from its page', (
      tester,
    ) async {
      await _pump(
        tester,
        appointments: _FakeAppointments(AppointmentStatus.completed),
        sales: _FakeSales(_sale(SaleStatus.pending)),
      );

      expect(find.text('Cobrar'), findsNothing);
      expect(find.text('Cobrar venta pendiente'), findsOneWidget);
    });
  });
}
