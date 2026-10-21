import 'package:citagof/core/errors/app_failure.dart';
import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/agenda/presentation/providers/upcoming_appointments_provider.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/domain/entities/business_registration.dart';
import 'package:citagof/features/authentication/domain/repositories/auth_repository.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/business/data/models/business_model.dart';
import 'package:citagof/features/business/domain/entities/business.dart';
import 'package:citagof/features/business/domain/repositories/business_repository.dart';
import 'package:citagof/features/business/presentation/providers/business_providers.dart';
import 'package:citagof/features/conversations/presentation/providers/pending_conversations_provider.dart';
import 'package:citagof/features/dashboard/domain/entities/dashboard.dart';
import 'package:citagof/features/dashboard/domain/repositories/dashboard_repository.dart';
import 'package:citagof/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:citagof/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

AuthSession _session(UserRole role) => AuthSession(
  user: const SessionUser(id: 'u1', email: 'o@demo.local', name: 'Diego'),
  tenant: const SessionTenant(
    id: 't1',
    name: 'Barberia Demo',
    currency: 'PEN',
    timezone: 'America/Lima',
  ),
  role: role,
);

class _SignedIn extends Fake implements AuthRepository {
  _SignedIn(this.role);

  final UserRole role;

  @override
  Future<AuthSession> login({
    required String email,
    required String password,
  }) => throw UnimplementedError();

  @override
  Future<AuthSession> register(BusinessRegistration registration) =>
      throw UnimplementedError();

  @override
  Future<AuthSession?> restore() async => _session(role);

  @override
  Future<void> logout() async {}
}

class _Dashboard implements DashboardRepository {
  @override
  Future<BusinessDashboard> businessToday() =>
      throw const AppFailure(message: 'x');

  @override
  Future<OwnDashboard> ownToday() => throw const AppFailure(message: 'x');
}

Business _demoBusiness({List<ScheduleRange>? hours}) => Business(
  id: 't1',
  name: 'Barberia Demo',
  country: 'PE',
  currency: 'PEN',
  timezone: 'America/Lima',
  phone: '+51999111222',
  email: 'hola@demo.pe',
  hours:
      hours ??
      const [
        ScheduleRange(weekday: 1, startsAt: '09:00', endsAt: '13:00'),
        ScheduleRange(weekday: 1, startsAt: '15:00', endsAt: '19:00'),
      ],
);

class _FakeBusiness implements BusinessRepository {
  _FakeBusiness(this.business);

  Business business;
  BusinessInput? updated;
  List<ScheduleRange>? savedHours;

  @override
  Future<Business> get() async => business;

  @override
  Future<Business> update(BusinessInput input) async {
    updated = input;
    return business;
  }

  @override
  Future<Business> replaceHours(List<ScheduleRange> ranges) async {
    savedHours = ranges;
    return business;
  }
}

Future<void> _openBusiness(
  WidgetTester tester,
  _FakeBusiness repo, {
  UserRole role = UserRole.owner,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      retry: (_, _) => null,
      overrides: [
        authRepositoryProvider.overrideWithValue(_SignedIn(role)),
        dashboardRepositoryProvider.overrideWithValue(_Dashboard()),
        businessRepositoryProvider.overrideWithValue(repo),
        pendingConversationsCountProvider.overrideWith((ref) async => 0),
        upcomingAppointmentsProvider.overrideWith((ref) async => []),
      ],
      child: const CitaGoApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Más'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Mi negocio'));
  await tester.pumpAndSettle();
}

Future<void> _openHoursEditor(WidgetTester tester) async {
  await tester.scrollUntilVisible(
    find.text('Horario de atención'),
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.tap(find.widgetWithText(TextButton, 'Editar').last);
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  group('business models', () {
    test('parses the settings and the opening hours', () {
      final business = businessFromJson({
        'id': 't1',
        'name': 'Barberia Demo',
        'country': 'PE',
        'currency': 'PEN',
        'timezone': 'America/Lima',
        'phone': '+51999111222',
        'email': null,
        'hours': [
          {'weekday': 1, 'startsAt': '09:00', 'endsAt': '13:00'},
        ],
      });
      expect(business.currency, 'PEN');
      expect(business.hours, hasLength(1));
      expect(business.hours.first.weekday, 1);
    });

    test('update body never sends the currency and clears blank fields', () {
      final body = updateBusinessBody(
        const BusinessInput(
          name: ' Demo ',
          timezone: 'America/Lima',
          phone: '',
          email: '',
        ),
      );
      expect(body.containsKey('currency'), isFalse);
      expect(body, {
        'name': 'Demo',
        'timezone': 'America/Lima',
        'phone': null,
        'email': null,
      });
    });

    test('hours body sends a flat ranges array', () {
      final body = replaceHoursBody(const [
        ScheduleRange(weekday: 1, startsAt: '09:00', endsAt: '13:00'),
      ]);
      expect(body, {
        'ranges': [
          {'weekday': 1, 'startsAt': '09:00', 'endsAt': '13:00'},
        ],
      });
    });
  });

  group('hours validation', () {
    test('accepts semi-open adjacent ranges', () {
      final result = validateBusinessHours(const [
        ScheduleRange(weekday: 1, startsAt: '09:00', endsAt: '12:00'),
        ScheduleRange(weekday: 1, startsAt: '12:00', endsAt: '18:00'),
      ]);
      expect(result, isNull);
    });

    test('rejects overlapping ranges on the same day', () {
      final result = validateBusinessHours(const [
        ScheduleRange(weekday: 1, startsAt: '09:00', endsAt: '13:00'),
        ScheduleRange(weekday: 1, startsAt: '12:00', endsAt: '18:00'),
      ]);
      expect(result, contains('solaparse'));
    });

    test('rejects a range that ends before it starts', () {
      final result = validateBusinessHours(const [
        ScheduleRange(weekday: 2, startsAt: '18:00', endsAt: '09:00'),
      ]);
      expect(result, contains('antes de terminar'));
    });

    test('ranges on different days do not conflict', () {
      final result = validateBusinessHours(const [
        ScheduleRange(weekday: 1, startsAt: '09:00', endsAt: '13:00'),
        ScheduleRange(weekday: 2, startsAt: '09:00', endsAt: '13:00'),
      ]);
      expect(result, isNull);
    });
  });

  testWidgets('shows the currency read-only', (tester) async {
    await _openBusiness(tester, _FakeBusiness(_demoBusiness()));

    expect(find.text('Moneda'), findsOneWidget);
    expect(find.textContaining('No se puede cambiar'), findsOneWidget);
    expect(find.textContaining('PEN'), findsWidgets);
  });

  testWidgets('shows the opening hours', (tester) async {
    await _openBusiness(tester, _FakeBusiness(_demoBusiness()));

    await tester.scrollUntilVisible(
      find.text('Lunes'),
      200,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('Lunes'), findsOneWidget);
    expect(find.textContaining('09:00'), findsWidgets);
    expect(find.text('Cerrado'), findsWidgets);
  });

  testWidgets('the settings form keeps the currency read-only', (tester) async {
    await _openBusiness(tester, _FakeBusiness(_demoBusiness()));

    await tester.tap(find.widgetWithText(TextButton, 'Editar').first);
    await tester.pumpAndSettle();

    expect(find.widgetWithText(TextFormField, 'Moneda'), findsNothing);
    expect(find.text('PEN'), findsWidgets);
  });

  testWidgets('saving the hours editor rejects an overlap', (tester) async {
    final repo = _FakeBusiness(
      _demoBusiness(
        hours: const [
          ScheduleRange(weekday: 1, startsAt: '09:00', endsAt: '13:00'),
          ScheduleRange(weekday: 1, startsAt: '12:00', endsAt: '18:00'),
        ],
      ),
    );
    await _openBusiness(tester, repo);
    await _openHoursEditor(tester);

    await tester.tap(find.text('Guardar horario'));
    await tester.pumpAndSettle();

    expect(find.textContaining('no pueden solaparse'), findsOneWidget);
    expect(repo.savedHours, isNull);
  });

  testWidgets('saving a valid week calls the API', (tester) async {
    final repo = _FakeBusiness(
      _demoBusiness(
        hours: const [
          ScheduleRange(weekday: 1, startsAt: '09:00', endsAt: '13:00'),
        ],
      ),
    );
    await _openBusiness(tester, repo);
    await _openHoursEditor(tester);

    await tester.tap(find.text('Guardar horario'));
    await tester.pumpAndSettle();

    expect(repo.savedHours, isNotNull);
    expect(repo.savedHours!.first.weekday, 1);
  });

  testWidgets('staff never see the Mi negocio menu entry', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        retry: (_, _) => null,
        overrides: [
          authRepositoryProvider.overrideWithValue(_SignedIn(UserRole.staff)),
          dashboardRepositoryProvider.overrideWithValue(_Dashboard()),
          businessRepositoryProvider.overrideWithValue(
            _FakeBusiness(_demoBusiness()),
          ),
          pendingConversationsCountProvider.overrideWith((ref) async => 0),
          upcomingAppointmentsProvider.overrideWith((ref) async => []),
        ],
        child: const CitaGoApp(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Más'));
    await tester.pumpAndSettle();

    expect(find.text('Mi negocio'), findsNothing);
  });
}
