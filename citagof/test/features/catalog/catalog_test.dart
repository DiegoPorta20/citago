import 'package:citagof/core/errors/app_failure.dart';
import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/agenda/presentation/providers/upcoming_appointments_provider.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/domain/entities/business_registration.dart';
import 'package:citagof/features/authentication/domain/repositories/auth_repository.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/catalog/data/models/service_model.dart';
import 'package:citagof/features/catalog/domain/entities/service.dart';
import 'package:citagof/features/catalog/domain/repositories/service_repository.dart';
import 'package:citagof/features/catalog/presentation/providers/service_providers.dart';
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
    name: 'Barbería Demo',
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

class _FakeServices implements ServiceRepository {
  _FakeServices(List<Service> seed) : services = [...seed];

  final List<Service> services;
  final List<String> activated = [];
  final List<String> deactivated = [];
  ServiceInput? created;
  ServiceInput? updated;
  AppFailure? createFailure;

  @override
  Future<List<Service>> list({bool activeOnly = false}) async =>
      services.where((s) => !activeOnly || s.active).toList();

  @override
  Future<List<Service>> listAll({
    ServiceFilter filter = ServiceFilter.all,
  }) async {
    return services.where((s) {
      return switch (filter) {
        ServiceFilter.active => s.active,
        ServiceFilter.inactive => !s.active,
        ServiceFilter.all => true,
      };
    }).toList();
  }

  @override
  Future<Service> get(String id) async =>
      services.firstWhere((s) => s.id == id);

  @override
  Future<Service> create(ServiceInput input) async {
    if (createFailure != null) throw createFailure!;
    created = input;
    final service = Service(
      id: 'new',
      name: input.name,
      durationMinutes: input.durationMinutes,
      price: input.price,
      active: true,
    );
    services.add(service);
    return service;
  }

  @override
  Future<Service> update(String id, ServiceInput input) async {
    updated = input;
    return Service(
      id: id,
      name: input.name,
      durationMinutes: input.durationMinutes,
      price: input.price,
      active: true,
    );
  }

  @override
  Future<Service> activate(String id) async {
    activated.add(id);
    final s = services.firstWhere((s) => s.id == id);
    final updatedService = Service(
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
      price: s.price,
      active: true,
    );
    services[services.indexOf(s)] = updatedService;
    return updatedService;
  }

  @override
  Future<Service> deactivate(String id) async {
    deactivated.add(id);
    final s = services.firstWhere((s) => s.id == id);
    final updatedService = Service(
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
      price: s.price,
      active: false,
    );
    services[services.indexOf(s)] = updatedService;
    return updatedService;
  }
}

Future<void> _openServices(
  WidgetTester tester,
  _FakeServices repo, {
  UserRole role = UserRole.owner,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      retry: (_, _) => null,
      overrides: [
        authRepositoryProvider.overrideWithValue(_SignedIn(role)),
        dashboardRepositoryProvider.overrideWithValue(_Dashboard()),
        serviceRepositoryProvider.overrideWithValue(repo),
        pendingConversationsCountProvider.overrideWith((ref) async => 0),
        upcomingAppointmentsProvider.overrideWith((ref) async => []),
      ],
      child: const CitaGoApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Más'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Servicios'));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  group('service models', () {
    test('parses status into the active flag', () {
      final active = serviceFromJson({
        'id': '1',
        'name': 'Corte',
        'durationMinutes': 30,
        'price': '25.00',
        'status': 'ACTIVE',
      });
      final inactive = serviceFromJson({
        'id': '2',
        'name': 'Barba',
        'durationMinutes': 15,
        'price': '10.00',
        'status': 'INACTIVE',
      });
      expect(active.active, isTrue);
      expect(inactive.active, isFalse);
    });

    test('create body omits a blank description', () {
      final body = createServiceBody(
        const ServiceInput(
          name: ' Corte ',
          durationMinutes: 30,
          price: '25.00',
        ),
      );
      expect(body, {'name': 'Corte', 'durationMinutes': 30, 'price': '25.00'});
    });

    test('update body sends the description so a blank clears it', () {
      final body = updateServiceBody(
        const ServiceInput(name: 'Corte', durationMinutes: 45, price: '30.00'),
      );
      expect(body, {
        'name': 'Corte',
        'durationMinutes': 45,
        'price': '30.00',
        'description': '',
      });
    });
  });

  testWidgets('the list shows an inactive badge', (tester) async {
    await _openServices(
      tester,
      _FakeServices([
        const Service(
          id: 'a',
          name: 'Corte clásico',
          durationMinutes: 30,
          price: '25.00',
          active: true,
        ),
        const Service(
          id: 'b',
          name: 'Afeitado',
          durationMinutes: 20,
          price: '15.00',
          active: false,
        ),
      ]),
    );

    expect(find.text('Corte clásico'), findsOneWidget);
    expect(find.text('Afeitado'), findsOneWidget);
    expect(find.text('Inactivo'), findsOneWidget);
    expect(find.text('S/ 25.00'), findsNothing);
    expect(find.textContaining('S/ 25.00'), findsOneWidget);
  });

  testWidgets('creating a service sends the right body', (tester) async {
    final repo = _FakeServices([]);
    await _openServices(tester, repo);

    await tester.tap(find.text('Nuevo'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nombre'),
      'Corte',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Duración (minutos)'),
      '30',
    );
    await tester.enterText(find.widgetWithText(TextFormField, 'Precio'), '25');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(repo.created?.name, 'Corte');
    expect(repo.created?.durationMinutes, 30);
    expect(repo.created?.price, '25.00');
  });

  testWidgets('the form rejects an out-of-range duration', (tester) async {
    final repo = _FakeServices([]);
    await _openServices(tester, repo);

    await tester.tap(find.text('Nuevo'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nombre'),
      'Corte',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Duración (minutos)'),
      '0',
    );
    await tester.enterText(find.widgetWithText(TextFormField, 'Precio'), '25');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Entre 1 y 720'), findsWidgets);
    expect(repo.created, isNull);
  });

  testWidgets('a duplicate name shows a friendly error', (tester) async {
    final repo = _FakeServices([])
      ..createFailure = failureFromApi(
        statusCode: 409,
        code: 'DUPLICATE_SERVICE_NAME',
      );
    await _openServices(tester, repo);

    await tester.tap(find.text('Nuevo'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nombre'),
      'Corte',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Duración (minutos)'),
      '30',
    );
    await tester.enterText(find.widgetWithText(TextFormField, 'Precio'), '25');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(
      find.text('Ya existe un servicio activo con ese nombre.'),
      findsOneWidget,
    );
  });

  testWidgets('deactivating an active service calls the API', (tester) async {
    final repo = _FakeServices([
      const Service(
        id: 'a',
        name: 'Corte clásico',
        durationMinutes: 30,
        price: '25.00',
        active: true,
      ),
    ]);
    await _openServices(tester, repo);

    await tester.tap(find.byTooltip('Acciones'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Desactivar'));
    await tester.pumpAndSettle();

    expect(repo.deactivated, ['a']);
  });

  testWidgets('activating an inactive service calls the API', (tester) async {
    final repo = _FakeServices([
      const Service(
        id: 'b',
        name: 'Afeitado',
        durationMinutes: 20,
        price: '15.00',
        active: false,
      ),
    ]);
    await _openServices(tester, repo);

    await tester.tap(find.byTooltip('Acciones'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Activar'));
    await tester.pumpAndSettle();

    expect(repo.activated, ['b']);
  });

  testWidgets('staff never see the Servicios menu entry', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        retry: (_, _) => null,
        overrides: [
          authRepositoryProvider.overrideWithValue(_SignedIn(UserRole.staff)),
          dashboardRepositoryProvider.overrideWithValue(_Dashboard()),
          serviceRepositoryProvider.overrideWithValue(_FakeServices([])),
          pendingConversationsCountProvider.overrideWith((ref) async => 0),
          upcomingAppointmentsProvider.overrideWith((ref) async => []),
        ],
        child: const CitaGoApp(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Más'));
    await tester.pumpAndSettle();

    expect(find.text('Servicios'), findsNothing);
  });
}
