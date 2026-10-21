import 'package:citagof/core/errors/app_failure.dart';
import 'package:citagof/core/network/api_response.dart';
import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/agenda/presentation/providers/upcoming_appointments_provider.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/domain/repositories/auth_repository.dart';
import 'package:citagof/features/authentication/domain/entities/business_registration.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/clients/data/models/client_model.dart';
import 'package:citagof/features/clients/domain/entities/client.dart';
import 'package:citagof/features/clients/domain/repositories/client_repository.dart';
import 'package:citagof/features/clients/presentation/providers/client_providers.dart';
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

class _FakeClients implements ClientRepository {
  _FakeClients(List<Client> seed) : clients = [...seed];

  final List<Client> clients;
  final List<String> deleted = [];
  final List<String?> queries = [];
  AppFailure? createFailure;
  ClientInput? created;

  @override
  Future<Paged<Client>> list({
    String? query,
    int page = 1,
    int limit = 20,
  }) async {
    queries.add(query);
    final matches = clients
        .where(
          (c) =>
              query == null ||
              c.name.toLowerCase().startsWith(query.toLowerCase()),
        )
        .toList();
    final start = (page - 1) * limit;
    final slice = matches.skip(start).take(limit).toList();
    return Paged(
      items: slice,
      page: page,
      limit: limit,
      total: matches.length,
      totalPages: (matches.length / limit).ceil().clamp(1, 1 << 20),
    );
  }

  @override
  Future<Client> get(String id) async => clients.firstWhere((c) => c.id == id);

  @override
  Future<Client> create(ClientInput input) async {
    if (createFailure != null) throw createFailure!;
    created = input;
    final client = Client(id: 'new', name: input.name, phone: input.phone);
    clients.add(client);
    return client;
  }

  @override
  Future<Client> update(String id, ClientInput input) async =>
      Client(id: id, name: input.name);

  @override
  Future<void> delete(String id) async {
    deleted.add(id);
    clients.removeWhere((c) => c.id == id);
  }

  @override
  Future<Client> restore(String id) async =>
      clients.firstWhere((c) => c.id == id);
}

Future<void> _openClients(
  WidgetTester tester,
  _FakeClients repo, {
  UserRole role = UserRole.owner,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      retry: (_, _) => null,
      overrides: [
        authRepositoryProvider.overrideWithValue(_SignedIn(role)),
        dashboardRepositoryProvider.overrideWithValue(_Dashboard()),
        clientRepositoryProvider.overrideWithValue(repo),
        pendingConversationsCountProvider.overrideWith((ref) async => 0),
        upcomingAppointmentsProvider.overrideWith((ref) async => []),
      ],
      child: const CitaGoApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Clientes'));
  await tester.pumpAndSettle();
}

List<Client> _many(int n) => [
  for (var i = 0; i < n; i++)
    Client(id: 'c$i', name: 'Cliente ${i.toString().padLeft(2, '0')}'),
];

void main() {
  setUpAll(initializeBusinessTime);

  group('client models', () {
    test('create body omits blank optional fields', () {
      final body = createClientBody(
        const ClientInput(name: ' Ana ', phone: ''),
      );
      expect(body, {'name': 'Ana'});
    });

    test('update body sends empty strings so the API clears the field', () {
      final body = updateClientBody(const ClientInput(name: 'Ana'));
      expect(body, {'name': 'Ana', 'phone': '', 'email': '', 'notes': ''});
    });

    test('initials use the first two words', () {
      expect(const Client(id: '1', name: 'juan carlos pérez').initials, 'JC');
    });
  });

  testWidgets('lists clients and opens the detail', (tester) async {
    await _openClients(
      tester,
      _FakeClients([
        const Client(id: 'a', name: 'Ana Ruiz', phone: '+51999111222'),
      ]),
    );

    expect(find.text('Ana Ruiz'), findsOneWidget);
    expect(find.text('+51999111222'), findsOneWidget);

    await tester.tap(find.text('Ana Ruiz'));
    await tester.pumpAndSettle();

    expect(find.text('Teléfono'), findsOneWidget);
  });

  testWidgets('shows the empty state when there are no clients', (
    tester,
  ) async {
    await _openClients(tester, _FakeClients([]));

    expect(find.textContaining('Aún no hay clientes'), findsOneWidget);
  });

  testWidgets('searching asks the API for the typed text', (tester) async {
    final repo = _FakeClients([
      const Client(id: 'a', name: 'Ana Ruiz'),
      const Client(id: 'b', name: 'Beto Díaz'),
    ]);
    await _openClients(tester, repo);

    await tester.enterText(find.byType(TextField), 'Be');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    expect(repo.queries.last, 'Be');
    expect(find.text('Beto Díaz'), findsOneWidget);
    expect(find.text('Ana Ruiz'), findsNothing);
  });

  testWidgets('a search without results says so', (tester) async {
    await _openClients(
      tester,
      _FakeClients([const Client(id: 'a', name: 'Ana')]),
    );

    await tester.enterText(find.byType(TextField), 'Zzz');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    expect(find.textContaining('No encontramos clientes'), findsOneWidget);
  });

  testWidgets('scrolling to the end loads the next page', (tester) async {
    final repo = _FakeClients(_many(45));
    await _openClients(tester, repo);

    expect(find.text('Cliente 00'), findsOneWidget);
    expect(find.text('Cliente 30'), findsNothing);

    await tester.scrollUntilVisible(
      find.text('Cliente 30'),
      400,
      scrollable: find.descendant(
        of: find.byType(ListView),
        matching: find.byType(Scrollable),
      ),
    );

    expect(find.text('Cliente 30'), findsOneWidget);
  });

  testWidgets('creating a client opens the new client', (tester) async {
    final repo = _FakeClients([]);
    await _openClients(tester, repo);

    await tester.tap(find.text('Nuevo'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Luis Mora');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(repo.created?.name, 'Luis Mora');
    expect(find.text('Luis Mora'), findsWidgets);
    expect(find.text('Teléfono'), findsOneWidget);
  });

  testWidgets('the form requires a name', (tester) async {
    final repo = _FakeClients([]);
    await _openClients(tester, repo);

    await tester.tap(find.text('Nuevo'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Escribe el nombre'), findsOneWidget);
    expect(repo.created, isNull);
  });

  testWidgets('a duplicate phone offers to open the existing client', (
    tester,
  ) async {
    final repo = _FakeClients([const Client(id: 'dup', name: 'Ana Ruiz')])
      ..createFailure = failureFromApi(
        statusCode: 409,
        code: 'CLIENT_PHONE_ALREADY_REGISTERED',
        details: {'clientId': 'dup'},
      );
    await _openClients(tester, repo);

    await tester.tap(find.text('Nuevo'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Otra Ana');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Ese teléfono ya está registrado'), findsOneWidget);
    await tester.tap(find.text('Abrir cliente'));
    await tester.pumpAndSettle();

    expect(find.text('Ana Ruiz'), findsWidgets);
    expect(find.text('Teléfono'), findsOneWidget);
  });

  testWidgets('staff cannot restore a deleted client with the same phone', (
    tester,
  ) async {
    final repo = _FakeClients([])
      ..createFailure = failureFromApi(
        statusCode: 409,
        code: 'CLIENT_DELETED_WITH_SAME_PHONE',
        details: {'clientId': 'old', 'restorable': true},
      );
    await _openClients(tester, repo, role: UserRole.staff);

    await tester.tap(find.text('Nuevo'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Ana');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Restaurar'), findsNothing);
    expect(find.textContaining('Pide a un administrador'), findsOneWidget);
  });

  testWidgets('an owner can delete a client after confirming', (tester) async {
    final repo = _FakeClients([const Client(id: 'a', name: 'Ana Ruiz')]);
    await _openClients(tester, repo);

    await tester.tap(find.text('Ana Ruiz'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Eliminar'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Eliminar'));
    await tester.pumpAndSettle();

    expect(repo.deleted, ['a']);
    expect(find.textContaining('Aún no hay clientes'), findsOneWidget);
  });

  testWidgets('staff do not get the delete action', (tester) async {
    await _openClients(
      tester,
      _FakeClients([const Client(id: 'a', name: 'Ana Ruiz')]),
      role: UserRole.staff,
    );

    await tester.tap(find.text('Ana Ruiz'));
    await tester.pumpAndSettle();

    expect(find.byTooltip('Eliminar'), findsNothing);
    expect(find.byTooltip('Editar'), findsOneWidget);
  });
}
