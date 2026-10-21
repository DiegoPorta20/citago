import 'package:citagof/core/errors/app_failure.dart';
import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/domain/entities/business_registration.dart';
import 'package:citagof/features/authentication/domain/repositories/auth_repository.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/dashboard/domain/entities/dashboard.dart';
import 'package:citagof/features/dashboard/domain/repositories/dashboard_repository.dart';
import 'package:citagof/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:citagof/features/agenda/domain/entities/appointment.dart';
import 'package:citagof/features/agenda/domain/entities/appointment_status.dart';
import 'package:citagof/features/agenda/presentation/providers/upcoming_appointments_provider.dart';
import 'package:citagof/features/conversations/presentation/providers/pending_conversations_provider.dart';
import 'package:citagof/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

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

class _FakeAuth extends Fake implements AuthRepository {
  _FakeAuth({this.stored, this.role = UserRole.owner});

  AuthSession? stored;
  final UserRole role;
  bool loggedOut = false;

  @override
  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    if (password != 'Demo1234!') {
      throw failureFromApi(statusCode: 401, code: 'INVALID_CREDENTIALS');
    }
    return stored = _session(role);
  }

  List<TenantChoice> tenantChoices = const [];
  String? switchedTo;

  @override
  Future<List<TenantChoice>> tenants() async => tenantChoices;

  @override
  Future<void> switchTenant(String tenantId) async => switchedTo = tenantId;

  BusinessRegistration? registered;
  AppFailure? registerFailure;

  @override
  Future<AuthSession> register(BusinessRegistration registration) async {
    if (registerFailure != null) throw registerFailure!;
    registered = registration;
    return stored = _session(UserRole.owner);
  }

  @override
  Future<AuthSession?> restore() async => stored;

  @override
  Future<void> logout() async {
    loggedOut = true;
    stored = null;
  }
}

class _FakeDashboard implements DashboardRepository {
  @override
  Future<BusinessDashboard> businessToday() async => const BusinessDashboard(
    from: '2026-10-20',
    to: '2026-10-20',
    currency: 'PEN',
    revenue: Revenue(
      paid: '820.00',
      paidCount: 28,
      pending: '0.00',
      pendingCount: 0,
    ),
    appointments: AppointmentCounters(
      total: 12,
      completed: 9,
      cancelled: 1,
      noShow: 2,
    ),
    newClients: 3,
    topServices: [
      ServiceSales(
        description: 'Corte de cabello',
        quantity: 18,
        total: '450.00',
      ),
    ],
    staff: [
      StaffPerformance(
        name: 'Carlos',
        completedAppointments: 9,
        revenue: '400.00',
      ),
    ],
  );

  @override
  Future<OwnDashboard> ownToday() async => const OwnDashboard(
    from: '2026-10-20',
    to: '2026-10-20',
    appointments: AppointmentCounters(
      total: 5,
      completed: 4,
      cancelled: 0,
      noShow: 0,
    ),
  );
}

Future<void> _pumpApp(WidgetTester tester, _FakeAuth auth) async {
  await tester.pumpWidget(
    ProviderScope(
      retry: (_, _) => null,
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        dashboardRepositoryProvider.overrideWithValue(_FakeDashboard()),
        pendingConversationsCountProvider.overrideWith((ref) async => 3),
        upcomingAppointmentsProvider.overrideWith(
          (ref) async => [
            Appointment(
              id: 'a1',
              status: AppointmentStatus.confirmed,
              startAt: DateTime.now().toUtc().add(const Duration(hours: 1)),
              endAt: DateTime.now().toUtc().add(const Duration(hours: 2)),
              price: '25.00',
              client: const NamedRef(id: 'c1', name: 'Juan Pérez'),
              service: const NamedRef(id: 's1', name: 'Corte'),
            ),
          ],
        ),
      ],
      child: const CitaGoApp(),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _signIn(
  WidgetTester tester, {
  String password = 'Demo1234!',
}) async {
  await tester.enterText(find.byType(TextFormField).at(0), 'owner@demo.local');
  await tester.enterText(find.byType(TextFormField).at(1), password);
  await tester.tap(find.text('Entrar'));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);
  testWidgets('a signed-out user lands on login', (tester) async {
    await _pumpApp(tester, _FakeAuth());

    expect(find.text('Entrar'), findsOneWidget);
  });

  testWidgets('wrong credentials show a friendly message and stay on login', (
    tester,
  ) async {
    await _pumpApp(tester, _FakeAuth());

    await _signIn(tester, password: 'nope');

    expect(find.text('Correo o contraseña incorrectos.'), findsOneWidget);
    expect(find.text('Entrar'), findsOneWidget);
  });

  testWidgets('login validates empty fields without calling the API', (
    tester,
  ) async {
    await _pumpApp(tester, _FakeAuth());

    await tester.tap(find.text('Entrar'));
    await tester.pumpAndSettle();

    expect(find.text('Escribe un correo válido'), findsOneWidget);
    expect(find.text('Escribe tu contraseña'), findsOneWidget);
  });

  testWidgets('an owner signs in and sees the business revenue', (
    tester,
  ) async {
    await _pumpApp(tester, _FakeAuth());

    await _signIn(tester);

    expect(find.text('Barbería Demo'), findsOneWidget);
    expect(find.text('S/ 820.00'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Corte de cabello'), 200);
    expect(find.text('Corte de cabello'), findsOneWidget);
  });

  testWidgets('staff never see money', (tester) async {
    await _pumpApp(tester, _FakeAuth(role: UserRole.staff));

    await _signIn(tester);

    expect(find.textContaining('S/'), findsNothing);
    expect(find.text('Citas de hoy'), findsOneWidget);
    expect(find.text('4 atendidas'), findsOneWidget);
  });

  testWidgets('a stored session skips the login screen', (tester) async {
    await _pumpApp(tester, _FakeAuth(stored: _session(UserRole.owner)));

    expect(find.text('Entrar'), findsNothing);
    expect(find.text('S/ 820.00'), findsOneWidget);
  });

  testWidgets('signing out returns to login', (tester) async {
    final auth = _FakeAuth(stored: _session(UserRole.owner));
    await _pumpApp(tester, auth);

    await tester.tap(find.text('Más'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).last, const Offset(0, -400));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cerrar sesión'));
    await tester.pumpAndSettle();

    expect(auth.loggedOut, isTrue);
    expect(find.text('Entrar'), findsOneWidget);
  });
  testWidgets('the dashboard shows pending chats and upcoming appointments', (
    tester,
  ) async {
    await _pumpApp(tester, _FakeAuth(stored: _session(UserRole.owner)));

    expect(find.text('3 conversaciones por responder'), findsOneWidget);
    expect(find.text('Próximas citas'), findsOneWidget);
    expect(find.text('Juan Pérez'), findsOneWidget);
  });

  testWidgets('a new business can be registered from the login screen', (
    tester,
  ) async {
    final auth = _FakeAuth();
    await _pumpApp(tester, auth);

    await tester.tap(find.text('Crear mi negocio'));
    await tester.pumpAndSettle();
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Barbería Nueva');
    await tester.enterText(fields.at(1), 'Diego');
    await tester.enterText(fields.at(2), 'diego@nueva.pe');
    await tester.enterText(fields.at(3), 'unaClaveSegura1');
    await tester.ensureVisible(find.text('Crear negocio'));
    await tester.tap(find.text('Crear negocio'));
    await tester.pumpAndSettle();

    expect(auth.registered?.businessName, 'Barbería Nueva');
    expect(auth.registered?.country.currency, 'PEN');
    expect(find.text('S/ 820.00'), findsOneWidget);
  });

  testWidgets('registration rejects a short password locally', (tester) async {
    final auth = _FakeAuth();
    await _pumpApp(tester, auth);

    await tester.tap(find.text('Crear mi negocio'));
    await tester.pumpAndSettle();
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Barbería Nueva');
    await tester.enterText(fields.at(1), 'Diego');
    await tester.enterText(fields.at(2), 'diego@nueva.pe');
    await tester.enterText(fields.at(3), 'corta');
    await tester.ensureVisible(find.text('Crear negocio'));
    await tester.tap(find.text('Crear negocio'));
    await tester.pumpAndSettle();

    expect(auth.registered, isNull);
    expect(find.text('Usa al menos 10 caracteres'), findsOneWidget);
  });

  testWidgets('a duplicate email shows a friendly message', (tester) async {
    final auth = _FakeAuth()
      ..registerFailure = failureFromApi(
        statusCode: 409,
        code: 'EMAIL_ALREADY_REGISTERED',
      );
    await _pumpApp(tester, auth);

    await tester.tap(find.text('Crear mi negocio'));
    await tester.pumpAndSettle();
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Barbería Nueva');
    await tester.enterText(fields.at(1), 'Diego');
    await tester.enterText(fields.at(2), 'diego@nueva.pe');
    await tester.enterText(fields.at(3), 'unaClaveSegura1');
    await tester.ensureVisible(find.text('Crear negocio'));
    await tester.tap(find.text('Crear negocio'));
    await tester.pumpAndSettle();

    expect(find.text('Ya existe una cuenta con ese correo.'), findsOneWidget);
  });

  testWidgets('with several businesses the owner can switch to another', (
    tester,
  ) async {
    final auth = _FakeAuth(stored: _session(UserRole.owner))
      ..tenantChoices = const [
        TenantChoice(
          tenantId: 't1',
          name: 'Barbería Demo',
          role: UserRole.owner,
          current: true,
        ),
        TenantChoice(
          tenantId: 't2',
          name: 'Barbería Norte',
          role: UserRole.staff,
          current: false,
        ),
      ];
    await _pumpApp(tester, auth);

    await tester.tap(find.text('Más'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).last, const Offset(0, -400));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cambiar de negocio'));
    await tester.pumpAndSettle();

    expect(find.text('Actual'), findsOneWidget);
    await tester.tap(find.text('Barbería Norte'));
    await tester.pump(const Duration(milliseconds: 100));

    expect(auth.switchedTo, 't2');
  });

  testWidgets('with a single business there is no switcher', (tester) async {
    await _pumpApp(tester, _FakeAuth(stored: _session(UserRole.owner)));

    await tester.tap(find.text('Más'));
    await tester.pumpAndSettle();

    expect(find.text('Cambiar de negocio'), findsNothing);
  });
}
