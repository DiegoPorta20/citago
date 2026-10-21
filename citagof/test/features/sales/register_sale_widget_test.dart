import 'package:citagof/core/network/api_response.dart';
import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/agenda/domain/entities/appointment.dart';
import 'package:citagof/features/agenda/domain/entities/appointment_status.dart';
import 'package:citagof/features/agenda/domain/entities/availability.dart';
import 'package:citagof/features/agenda/domain/repositories/appointment_repository.dart';
import 'package:citagof/features/agenda/presentation/providers/agenda_providers.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/sales/domain/entities/sale.dart';
import 'package:citagof/features/sales/domain/repositories/sale_repository.dart';
import 'package:citagof/features/sales/presentation/pages/register_sale_page.dart';
import 'package:citagof/features/sales/presentation/providers/sale_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

final _fixedNow = DateTime.utc(2026, 10, 20, 14, 0);

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

final _completedAppointment = Appointment(
  id: 'a1',
  status: AppointmentStatus.completed,
  startAt: DateTime.utc(2026, 10, 20, 14),
  endAt: DateTime.utc(2026, 10, 20, 14, 30),
  price: '20.00',
  client: const NamedRef(id: 'c1', name: 'Ana'),
  service: const NamedRef(id: 's1', name: 'Corte'),
  staffMember: const NamedRef(id: 'm1', name: 'Carlos'),
);

class _FakeAppointmentRepository implements AppointmentRepository {
  @override
  Future<List<Appointment>> agenda({
    required DateTime from,
    required DateTime to,
    String? staffMemberId,
  }) async => const [];

  @override
  Future<Appointment> get(String id) async => _completedAppointment;

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

  @override
  Future<Appointment> transition(
    String id,
    AppointmentAction action, {
    String? reason,
  }) => throw UnimplementedError();
}

class _FakeSaleRepository implements SaleRepository {
  RegisterSaleInput? registered;

  @override
  Future<Sale> register(RegisterSaleInput input) async {
    registered = input;
    return Sale(
      id: 'sale1',
      status: SaleStatus.paid,
      currency: 'PEN',
      subtotal: '20.00',
      discount: input.discount,
      total: '15.00',
      paymentMethod: input.paymentMethod,
      lines: const [],
    );
  }

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

Future<void> _pump(WidgetTester tester, _FakeSaleRepository sales) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sessionControllerProvider.overrideWith(_SignedInSession.new),
        businessClockProvider.overrideWithValue(
          BusinessClock('America/Lima', now: () => _fixedNow),
        ),
        appointmentRepositoryProvider.overrideWithValue(
          _FakeAppointmentRepository(),
        ),
        saleRepositoryProvider.overrideWithValue(sales),
      ],
      child: const MaterialApp(home: RegisterSalePage(appointmentId: 'a1')),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  testWidgets('a discount above the subtotal blocks charging', (tester) async {
    final sales = _FakeSaleRepository();
    await _pump(tester, sales);

    await tester.enterText(find.byType(TextField), '25.00');
    await tester.pumpAndSettle();

    expect(find.text('Supera el subtotal'), findsOneWidget);

    final button = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Cobrar'),
    );
    expect(button.onPressed, isNull);
    expect(sales.registered, isNull);
  });

  testWidgets('a valid discount charges the derived total', (tester) async {
    final sales = _FakeSaleRepository();
    await _pump(tester, sales);

    await tester.enterText(find.byType(TextField), '5.00');
    await tester.pumpAndSettle();

    expect(find.text('S/ 15.00'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Cobrar'));
    await tester.pumpAndSettle();

    expect(sales.registered, isNotNull);
    expect(sales.registered!.discount, '5.00');
    expect(sales.registered!.paymentMethod, PaymentMethod.cash);
  });
}
