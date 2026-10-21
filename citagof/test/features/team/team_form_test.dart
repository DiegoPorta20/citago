import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/team/domain/entities/team_member.dart';
import 'package:citagof/features/team/domain/repositories/team_repository.dart';
import 'package:citagof/features/team/presentation/pages/team_member_form_page.dart';
import 'package:citagof/features/team/presentation/providers/team_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class FakeTeamRepository implements TeamRepository {
  FakeTeamRepository({this.addedPassword});

  String? addedPassword;
  TeamMemberInput? addedInput;
  final List<String> calls = [];

  @override
  Future<List<TeamMember>> list() async => const [];

  @override
  Future<AddedTeamMember> add(TeamMemberInput input) async {
    calls.add('add:${input.role.name}');
    addedInput = input;
    final member = TeamMember(
      id: 'm-new',
      userId: 'u-new',
      name: input.name,
      email: input.email,
      role: input.role,
      status: MembershipStatus.active,
    );
    return AddedTeamMember(member: member, temporaryPassword: addedPassword);
  }

  @override
  Future<TeamMember> changeRole(String membershipId, UserRole role) =>
      throw UnimplementedError();

  @override
  Future<TeamMember> revoke(String membershipId) => throw UnimplementedError();

  @override
  Future<TeamMember> restore(String membershipId) => throw UnimplementedError();
}

class FakeSessionController extends SessionController {
  FakeSessionController(this._session);
  final AuthSession _session;

  @override
  Future<AuthSession?> build() async => _session;
}

AuthSession _session(UserRole role) => AuthSession(
  user: const SessionUser(id: 'u1', email: 'me@demo.local', name: 'Diego'),
  tenant: const SessionTenant(
    id: 't1',
    name: 'Barbería Demo',
    currency: 'PEN',
    timezone: 'America/Lima',
  ),
  role: role,
);

Future<void> _pumpForm(
  WidgetTester tester,
  FakeTeamRepository repo, {
  required UserRole role,
}) async {
  final router = GoRouter(
    initialLocation: '/start',
    routes: [
      GoRoute(
        path: '/start',
        builder: (context, state) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () => context.push('/form'),
              child: const Text('open'),
            ),
          ),
        ),
      ),
      GoRoute(
        path: '/form',
        builder: (context, state) => const TeamMemberFormPage(),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        teamRepositoryProvider.overrideWithValue(repo),
        sessionControllerProvider.overrideWith(
          () => FakeSessionController(_session(role)),
        ),
      ],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  testWidgets('ADMIN cannot see ADMIN/OWNER role options', (tester) async {
    await _pumpForm(tester, FakeTeamRepository(), role: UserRole.admin);

    expect(find.text('Profesional'), findsOneWidget);
    expect(find.text('Administrador'), findsNothing);
    expect(find.text('Propietario'), findsNothing);
  });

  testWidgets('OWNER sees all three role options', (tester) async {
    await _pumpForm(tester, FakeTeamRepository(), role: UserRole.owner);

    expect(find.text('Profesional'), findsOneWidget);
    expect(find.text('Administrador'), findsOneWidget);
    expect(find.text('Propietario'), findsOneWidget);
  });

  testWidgets('the temporary password is shown once and gone after closing', (
    tester,
  ) async {
    final repo = FakeTeamRepository(addedPassword: 'Temp-9xZ!');
    await _pumpForm(tester, repo, role: UserRole.owner);

    await tester.enterText(find.byType(TextFormField).at(0), 'Luis Mora');
    await tester.enterText(find.byType(TextFormField).at(1), 'luis@demo.pe');
    await tester.tap(find.widgetWithText(FilledButton, 'Dar acceso'));
    await tester.pumpAndSettle();

    expect(find.text('Temp-9xZ!'), findsOneWidget);
    expect(find.text('Contraseña temporal'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Listo'));
    await tester.pumpAndSettle();

    expect(find.text('Temp-9xZ!'), findsNothing);
    expect(find.text('Contraseña temporal'), findsNothing);
    expect(repo.calls, contains('add:staff'));
  });

  testWidgets('no dialog is shown when the API returns no password', (
    tester,
  ) async {
    final repo = FakeTeamRepository(addedPassword: null);
    await _pumpForm(tester, repo, role: UserRole.owner);

    await tester.enterText(find.byType(TextFormField).at(0), 'Luis Mora');
    await tester.enterText(find.byType(TextFormField).at(1), 'luis@demo.pe');
    await tester.tap(find.widgetWithText(FilledButton, 'Dar acceso'));
    await tester.pumpAndSettle();

    expect(find.text('Contraseña temporal'), findsNothing);
  });
}
