import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/team/data/models/team_member_model.dart';
import 'package:citagof/features/team/domain/entities/team_member.dart';
import 'package:citagof/features/team/domain/permissions/team_permissions.dart';
import 'package:citagof/features/team/domain/repositories/team_repository.dart';
import 'package:citagof/features/team/presentation/pages/team_page.dart';
import 'package:citagof/features/team/presentation/providers/team_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeTeamRepository implements TeamRepository {
  FakeTeamRepository({List<TeamMember>? members, this.addedPassword})
    : members = [...?members];

  List<TeamMember> members;
  String? addedPassword;
  TeamMemberInput? addedInput;
  final List<String> calls = [];

  @override
  Future<List<TeamMember>> list() async {
    calls.add('list');
    return members;
  }

  @override
  Future<AddedTeamMember> add(TeamMemberInput input) async {
    calls.add('add:${input.name}:${input.role.name}');
    addedInput = input;
    final member = TeamMember(
      id: 'm-new',
      userId: 'u-new',
      name: input.name,
      email: input.email,
      role: input.role,
      status: MembershipStatus.active,
    );
    members = [...members, member];
    return AddedTeamMember(member: member, temporaryPassword: addedPassword);
  }

  @override
  Future<TeamMember> changeRole(String membershipId, UserRole role) async {
    calls.add('changeRole:$membershipId:${role.name}');
    return members.firstWhere((m) => m.id == membershipId);
  }

  @override
  Future<TeamMember> revoke(String membershipId) async {
    calls.add('revoke:$membershipId');
    return members.firstWhere((m) => m.id == membershipId);
  }

  @override
  Future<TeamMember> restore(String membershipId) async {
    calls.add('restore:$membershipId');
    return members.firstWhere((m) => m.id == membershipId);
  }
}

class FakeSessionController extends SessionController {
  FakeSessionController(this._session);
  final AuthSession _session;

  @override
  Future<AuthSession?> build() async => _session;
}

AuthSession _session(UserRole role, {String userId = 'u1'}) => AuthSession(
  user: SessionUser(id: userId, email: 'me@demo.local', name: 'Diego'),
  tenant: const SessionTenant(
    id: 't1',
    name: 'Barbería Demo',
    currency: 'PEN',
    timezone: 'America/Lima',
  ),
  role: role,
);

TeamMember _member({
  required String id,
  required String userId,
  String name = 'Ana',
  UserRole role = UserRole.staff,
  MembershipStatus status = MembershipStatus.active,
}) => TeamMember(
  id: id,
  userId: userId,
  name: name,
  email: '$name@demo.local'.toLowerCase(),
  role: role,
  status: status,
);

Future<void> _pump(
  WidgetTester tester,
  FakeTeamRepository repo, {
  UserRole role = UserRole.owner,
  String userId = 'u1',
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        teamRepositoryProvider.overrideWithValue(repo),
        sessionControllerProvider.overrideWith(
          () => FakeSessionController(_session(role, userId: userId)),
        ),
      ],
      child: const MaterialApp(home: TeamPage()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  group('models / bodies', () {
    test('addTeamMemberBody trims and maps the role to the API enum', () {
      final body = addTeamMemberBody(
        const TeamMemberInput(
          name: '  Luis  ',
          email: '  luis@demo.pe ',
          role: UserRole.staff,
        ),
      );
      expect(body, {'name': 'Luis', 'email': 'luis@demo.pe', 'role': 'STAFF'});
      expect(body.containsKey('password'), isFalse);
    });

    test('changeRoleBody maps the role', () {
      expect(changeRoleBody(UserRole.admin), {'role': 'ADMIN'});
    });

    test('teamMemberFromJson parses the membership and status', () {
      final m = teamMemberFromJson({
        'id': 'm1',
        'userId': 'u2',
        'name': 'Ana',
        'email': 'ana@demo.local',
        'role': 'ADMIN',
        'status': 'REVOKED',
      });
      expect(m.id, 'm1');
      expect(m.userId, 'u2');
      expect(m.role, UserRole.admin);
      expect(m.status, MembershipStatus.revoked);
      expect(m.isActive, isFalse);
    });

    test('addedTeamMemberFromJson carries the one-time temporary password', () {
      final added = addedTeamMemberFromJson({
        'id': 'm1',
        'userId': 'u2',
        'name': 'Ana',
        'email': 'ana@demo.local',
        'role': 'STAFF',
        'status': 'ACTIVE',
        'temporaryPassword': 'Temp-1234',
      });
      expect(added.temporaryPassword, 'Temp-1234');
    });
  });

  group('permissions (docs/permissions.md, ID-1/ID-7)', () {
    test('OWNER may grant any role; ADMIN only STAFF', () {
      expect(
        TeamPermissions.assignableRoles(UserRole.owner),
        containsAll(<UserRole>[UserRole.staff, UserRole.admin, UserRole.owner]),
      );
      expect(TeamPermissions.assignableRoles(UserRole.admin), const [
        UserRole.staff,
      ]);
      expect(TeamPermissions.assignableRoles(UserRole.staff), isEmpty);
    });

    test('an ADMIN cannot grant ADMIN or OWNER', () {
      expect(TeamPermissions.canGrant(UserRole.admin, UserRole.admin), isFalse);
      expect(TeamPermissions.canGrant(UserRole.admin, UserRole.owner), isFalse);
      expect(TeamPermissions.canGrant(UserRole.admin, UserRole.staff), isTrue);
    });

    test('nobody changes or revokes their own access (ID-7)', () {
      final self = _member(id: 'm1', userId: 'u1', role: UserRole.owner);
      expect(
        TeamPermissions.canChangeRole(UserRole.owner, 'u1', self),
        isFalse,
      );
      expect(TeamPermissions.canRevoke(UserRole.owner, 'u1', self), isFalse);
    });

    test('an ADMIN may only manage STAFF, never another ADMIN/OWNER', () {
      final staff = _member(id: 'm2', userId: 'u2', role: UserRole.staff);
      final admin = _member(id: 'm3', userId: 'u3', role: UserRole.admin);
      expect(
        TeamPermissions.canChangeRole(UserRole.admin, 'u1', staff),
        isTrue,
      );
      expect(
        TeamPermissions.canChangeRole(UserRole.admin, 'u1', admin),
        isFalse,
      );
      expect(TeamPermissions.canRevoke(UserRole.admin, 'u1', admin), isFalse);
    });
  });

  group('team list widget', () {
    testWidgets('lists memberships with role and status', (tester) async {
      await _pump(
        tester,
        FakeTeamRepository(
          members: [
            _member(
              id: 'm1',
              userId: 'u1',
              name: 'Diego',
              role: UserRole.owner,
            ),
            _member(
              id: 'm2',
              userId: 'u2',
              name: 'Ana',
              role: UserRole.staff,
              status: MembershipStatus.revoked,
            ),
          ],
        ),
      );

      expect(find.text('Diego'), findsOneWidget);
      expect(find.text('Ana'), findsOneWidget);
      expect(find.text('Propietario'), findsOneWidget);
      expect(find.text('Revocado'), findsOneWidget);
    });

    testWidgets('own row offers no revoke action (ID-7)', (tester) async {
      await _pump(
        tester,
        FakeTeamRepository(
          members: [
            _member(
              id: 'm1',
              userId: 'u1',
              name: 'Diego',
              role: UserRole.owner,
            ),
          ],
        ),
        userId: 'u1',
      );

      expect(find.byTooltip('Acciones'), findsNothing);
    });

    testWidgets('owner can revoke another member after confirming', (
      tester,
    ) async {
      final repo = FakeTeamRepository(
        members: [
          _member(id: 'm1', userId: 'u1', name: 'Diego', role: UserRole.owner),
          _member(id: 'm2', userId: 'u2', name: 'Ana', role: UserRole.staff),
        ],
      );
      await _pump(tester, repo, userId: 'u1');

      await tester.tap(find.byTooltip('Acciones'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Revocar acceso'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Revocar'));
      await tester.pumpAndSettle();

      expect(repo.calls, contains('revoke:m2'));
    });
  });
}
