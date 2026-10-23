import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/agenda/domain/entities/appointment.dart';
import 'package:citagof/features/agenda/domain/entities/appointment_status.dart';
import 'package:citagof/features/agenda/domain/entities/availability.dart';
import 'package:citagof/features/agenda/domain/repositories/appointment_repository.dart';
import 'package:citagof/features/agenda/presentation/pages/agenda_page.dart';
import 'package:citagof/features/agenda/presentation/pages/appointment_detail_page.dart';
import 'package:citagof/features/agenda/presentation/pages/new_appointment_page.dart';
import 'package:citagof/features/agenda/presentation/providers/agenda_providers.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/catalog/domain/entities/service.dart';
import 'package:citagof/features/catalog/domain/repositories/service_repository.dart';
import 'package:citagof/features/catalog/presentation/providers/service_providers.dart';
import 'package:citagof/features/clients/domain/entities/client.dart';
import 'package:citagof/features/clients/domain/repositories/client_repository.dart';
import 'package:citagof/features/clients/presentation/providers/client_providers.dart';
import 'package:citagof/core/network/api_response.dart';
import 'package:citagof/features/staff/domain/entities/staff_member.dart';
import 'package:citagof/features/staff/domain/repositories/staff_repository.dart';
import 'package:citagof/features/staff/presentation/providers/staff_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

final _fixedNow = DateTime.utc(2026, 10, 20, 14, 0);

AuthSession _session(UserRole role) => AuthSession(
  user: const SessionUser(id: 'u1', email: 'owner@demo.local', name: 'Diego'),
  tenant: const SessionTenant(
    id: 't1',
    name: 'Barbería Demo',
    currency: 'PEN',
    timezone: 'America/Lima',
  ),
  role: role,
);

Appointment _appointment({
  required String id,
  required AppointmentStatus status,
  required DateTime startAt,
  required DateTime endAt,
  String client = 'Ana',
  String service = 'Corte',
  String staff = 'Carlos',
  List<AppointmentStatusChange> history = const [],
  String? notes,
}) => Appointment(
  id: id,
  status: status,
  startAt: startAt,
  endAt: endAt,
  price: '25.00',
  notes: notes,
  client: NamedRef(id: 'c1', name: client),
  service: NamedRef(id: 's1', name: service),
  staffMember: NamedRef(id: 'm1', name: staff),
  history: history,
);

class FakeAppointmentRepository implements AppointmentRepository {
  FakeAppointmentRepository({List<Appointment>? agenda})
    : _agenda = agenda ?? const [];

  final List<Appointment> _agenda;
  BookAppointmentInput? bookedInput;
  String? lastTransitionReason;
  AppointmentAction? lastAction;
  Appointment? detail;

  @override
  Future<List<Appointment>> agenda({
    required DateTime from,
    required DateTime to,
    String? staffMemberId,
  }) async => _agenda;

  @override
  Future<Appointment> get(String id) async =>
      detail ?? _agenda.firstWhere((a) => a.id == id);

  @override
  Future<Availability> availability({
    required String staffMemberId,
    required String serviceId,
    required String date,
  }) async => Availability(
    date: date,
    durationMinutes: 30,
    slots: [
      AvailabilitySlot(
        startAt: DateTime.utc(2026, 10, 21, 14),
        endAt: DateTime.utc(2026, 10, 21, 14, 30),
        localTime: '09:00',
      ),
    ],
  );

  @override
  Future<Appointment> book(BookAppointmentInput input) async {
    bookedInput = input;
    return _appointment(
      id: 'new',
      status: AppointmentStatus.pending,
      startAt: input.startAt,
      endAt: input.startAt.add(const Duration(minutes: 30)),
    );
  }

  @override
  Future<Appointment> reschedule(String id, RescheduleInput input) async =>
      _agenda.firstWhere((a) => a.id == id);

  @override
  Future<Appointment> transition(
    String id,
    AppointmentAction action, {
    String? reason,
  }) async {
    lastAction = action;
    lastTransitionReason = reason;
    return detail ?? _agenda.firstWhere((a) => a.id == id);
  }
}

class FakeServiceRepository extends Fake implements ServiceRepository {
  @override
  Future<List<Service>> list({bool activeOnly = false}) async => const [
    Service(
      id: 's1',
      name: 'Corte',
      durationMinutes: 30,
      price: '25.00',
      active: true,
    ),
  ];
}

class FakeStaffRepository extends Fake implements StaffRepository {
  @override
  Future<List<StaffMember>> list() async => const [
    StaffMember(id: 'm1', displayName: 'Carlos', active: true, userId: 'u1'),
  ];
}

class FakeClientRepository implements ClientRepository {
  @override
  Future<Paged<Client>> list({
    String? query,
    int page = 1,
    int limit = 20,
  }) async => const Paged(
    items: [Client(id: 'c1', name: 'Ana')],
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  );

  @override
  Future<Client> get(String id) async => const Client(id: 'c1', name: 'Ana');

  @override
  Future<Client> create(ClientInput input) => throw UnimplementedError();

  @override
  Future<Client> update(String id, ClientInput input) =>
      throw UnimplementedError();

  @override
  Future<void> delete(String id) => throw UnimplementedError();

  @override
  Future<Client> restore(String id) => throw UnimplementedError();
}

class _SignedInSession extends SessionController {
  _SignedInSession(this.role);

  final UserRole role;

  @override
  Future<AuthSession?> build() async => _session(role);
}

Future<void> _pump(
  WidgetTester tester,
  Widget page, {
  required FakeAppointmentRepository appointments,
  UserRole role = UserRole.owner,
  FakeServiceRepository? services,
  FakeStaffRepository? staff,
  FakeClientRepository? clients,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sessionControllerProvider.overrideWith(() => _SignedInSession(role)),
        businessClockProvider.overrideWithValue(
          BusinessClock('America/Lima', now: () => _fixedNow),
        ),
        appointmentRepositoryProvider.overrideWithValue(appointments),
        serviceRepositoryProvider.overrideWithValue(
          services ?? FakeServiceRepository(),
        ),
        staffRepositoryProvider.overrideWithValue(
          staff ?? FakeStaffRepository(),
        ),
        clientRepositoryProvider.overrideWithValue(
          clients ?? FakeClientRepository(),
        ),
      ],
      child: MaterialApp.router(
        routerConfig: GoRouter(
          initialLocation: '/',
          routes: [
            GoRoute(path: '/', builder: (context, state) => page),
            GoRoute(
              path: '/agenda/:rest(.*)',
              builder: (context, state) =>
                  const Scaffold(body: Text('Navegado')),
            ),
          ],
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  testWidgets('agenda lists the day\'s appointments in the business zone', (
    tester,
  ) async {
    final repo = FakeAppointmentRepository(
      agenda: [
        _appointment(
          id: 'a1',
          status: AppointmentStatus.confirmed,
          startAt: DateTime.utc(2026, 10, 20, 14),
          endAt: DateTime.utc(2026, 10, 20, 14, 30),
        ),
      ],
    );

    await _pump(tester, const AgendaPage(), appointments: repo);

    expect(find.text('Ana'), findsOneWidget);
    expect(find.text('Corte · Carlos'), findsOneWidget);
    expect(find.text('09:00'), findsOneWidget);
    expect(find.text('Confirmada'), findsOneWidget);
  });

  testWidgets('agenda shows an empty state when there are no appointments', (
    tester,
  ) async {
    await _pump(
      tester,
      const AgendaPage(),
      appointments: FakeAppointmentRepository(),
    );

    expect(find.textContaining('No hay citas este día'), findsOneWidget);
  });

  testWidgets('detail shows only the actions valid for the status', (
    tester,
  ) async {
    final repo = FakeAppointmentRepository()
      ..detail = _appointment(
        id: 'a1',
        status: AppointmentStatus.inProgress,
        startAt: DateTime.utc(2026, 10, 20, 14),
        endAt: DateTime.utc(2026, 10, 20, 14, 30),
      );

    await _pump(
      tester,
      const AppointmentDetailPage(appointmentId: 'a1'),
      appointments: repo,
    );

    expect(find.widgetWithText(FilledButton, 'Completar'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Cancelar'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Confirmar'), findsNothing);
    expect(find.widgetWithText(FilledButton, 'No asistió'), findsNothing);
  });

  testWidgets('cancelling an IN_PROGRESS appointment requires a reason', (
    tester,
  ) async {
    final repo = FakeAppointmentRepository()
      ..detail = _appointment(
        id: 'a1',
        status: AppointmentStatus.inProgress,
        startAt: DateTime.utc(2026, 10, 20, 14),
        endAt: DateTime.utc(2026, 10, 20, 14, 30),
      );

    await _pump(
      tester,
      const AppointmentDetailPage(appointmentId: 'a1'),
      appointments: repo,
    );

    await tester.tap(find.widgetWithText(FilledButton, 'Cancelar'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Motivo (obligatorio)'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Cancelar cita'));
    await tester.pump();
    expect(repo.lastAction, isNull);
    expect(find.text('Motivo (obligatorio)'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Cliente se retiró');
    await tester.tap(find.widgetWithText(FilledButton, 'Cancelar cita'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.lastAction, AppointmentAction.cancel);
    expect(repo.lastTransitionReason, 'Cliente se retiró');
  });

  testWidgets('the week strip shows Monday to Sunday and selects a day', (
    tester,
  ) async {
    await _pump(
      tester,
      const AgendaPage(),
      appointments: FakeAppointmentRepository(),
    );

    for (final day in ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']) {
      expect(find.text(day), findsOneWidget);
    }
    expect(find.text('Octubre 2026'), findsOneWidget);
    expect(find.text('Hoy · Martes 20 de octubre'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Hoy'), findsNothing);

    await tester.tap(find.text('22'));
    await tester.pumpAndSettle();

    expect(find.text('Jueves 22 de octubre'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Hoy'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Hoy'));
    await tester.pumpAndSettle();

    expect(find.text('Hoy · Martes 20 de octubre'), findsOneWidget);
  });

  testWidgets('the next-week arrow keeps the weekday and crosses months', (
    tester,
  ) async {
    await _pump(
      tester,
      const AgendaPage(),
      appointments: FakeAppointmentRepository(),
    );

    await tester.tap(find.byTooltip('Semana siguiente'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Semana siguiente'));
    await tester.pumpAndSettle();

    // Tuesday 20 Oct + 14 days = Tuesday 3 Nov; its week is 2–8 Nov.
    expect(find.text('Noviembre 2026'), findsOneWidget);
    expect(find.text('Martes 3 de noviembre'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('8'), findsOneWidget);
  });

  testWidgets('creating an appointment sends the slot UTC startAt', (
    tester,
  ) async {
    final repo = FakeAppointmentRepository();

    await _pump(tester, const NewAppointmentPage(), appointments: repo);

    await tester.tap(find.text('Cliente'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ana'));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButtonFormField<Service>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Corte · 30 min').last);
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButtonFormField<StaffMember>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Carlos').last);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Fecha'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ChoiceChip, '09:00'));
    await tester.pumpAndSettle();

    await tester.dragUntilVisible(
      find.widgetWithText(FilledButton, 'Reservar'),
      find.byType(ListView),
      const Offset(0, -200),
    );
    await tester.pumpAndSettle();
    await tester.tap(
      find.widgetWithText(FilledButton, 'Reservar'),
      warnIfMissed: false,
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.bookedInput, isNotNull);
    expect(repo.bookedInput!.startAt, DateTime.utc(2026, 10, 21, 14));
    expect(repo.bookedInput!.startAt.isUtc, isTrue);
  });
}
