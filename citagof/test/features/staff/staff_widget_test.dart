import 'package:citagof/core/errors/app_failure.dart';
import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/agenda/presentation/providers/upcoming_appointments_provider.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/domain/entities/business_registration.dart';
import 'package:citagof/features/authentication/domain/repositories/auth_repository.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/conversations/presentation/providers/pending_conversations_provider.dart';
import 'package:citagof/features/dashboard/domain/entities/dashboard.dart';
import 'package:citagof/features/dashboard/domain/repositories/dashboard_repository.dart';
import 'package:citagof/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:citagof/features/staff/domain/entities/staff_member.dart';
import 'package:citagof/features/staff/domain/repositories/staff_repository.dart';
import 'package:citagof/features/staff/presentation/providers/staff_providers.dart';
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

class _FakeStaff implements StaffRepository {
  _FakeStaff(List<StaffMember> seed) : members = [...seed];

  final List<StaffMember> members;

  StaffMemberInput? created;
  List<Map<String, dynamic>>? replacedSchedule;
  final List<String> deactivated = [];
  final List<String> activated = [];
  final List<TimeOff> timeOff = [];
  DateTime? addedStart;
  DateTime? addedEnd;
  String? addedReason;
  final List<String> removedTimeOff = [];

  StaffMember _byId(String id) => members.firstWhere((m) => m.id == id);

  @override
  Future<List<StaffMember>> list() async => members;

  @override
  Future<StaffMember> get(String id) async => _byId(id);

  @override
  Future<StaffMember> create(StaffMemberInput input) async {
    created = input;
    final member = StaffMember(
      id: 'new',
      displayName: input.displayName,
      active: true,
    );
    members.add(member);
    return member;
  }

  @override
  Future<StaffMember> update(String id, StaffMemberInput input) async {
    final updated = StaffMember(
      id: id,
      displayName: input.displayName,
      active: _byId(id).active,
      userId: input.userId.isEmpty ? null : input.userId,
    );
    members
      ..removeWhere((m) => m.id == id)
      ..add(updated);
    return updated;
  }

  @override
  Future<StaffMember> activate(String id) async {
    activated.add(id);
    final current = _byId(id);
    final updated = StaffMember(
      id: id,
      displayName: current.displayName,
      active: true,
      schedule: current.schedule,
    );
    members
      ..removeWhere((m) => m.id == id)
      ..add(updated);
    return updated;
  }

  @override
  Future<StaffMember> deactivate(String id) async {
    deactivated.add(id);
    final current = _byId(id);
    final updated = StaffMember(
      id: id,
      displayName: current.displayName,
      active: false,
      schedule: current.schedule,
    );
    members
      ..removeWhere((m) => m.id == id)
      ..add(updated);
    return updated;
  }

  @override
  Future<StaffMember> replaceSchedule(
    String id,
    List<Map<String, dynamic>> ranges,
  ) async {
    replacedSchedule = ranges;
    return _byId(id);
  }

  @override
  Future<List<TimeOff>> listTimeOff(
    String id, {
    required DateTime from,
    required DateTime to,
  }) async => timeOff.where((t) => t.staffMemberId == id).toList();

  @override
  Future<TimeOff> addTimeOff(
    String id, {
    required DateTime startsAt,
    required DateTime endsAt,
    String? reason,
  }) async {
    addedStart = startsAt;
    addedEnd = endsAt;
    addedReason = reason;
    final created = TimeOff(
      id: 'to-${timeOff.length}',
      staffMemberId: id,
      startsAt: startsAt,
      endsAt: endsAt,
      reason: reason,
    );
    timeOff.add(created);
    return created;
  }

  @override
  Future<void> removeTimeOff(String id, String timeOffId) async {
    removedTimeOff.add(timeOffId);
    timeOff.removeWhere((t) => t.id == timeOffId);
  }
}

Future<void> _openStaff(
  WidgetTester tester,
  _FakeStaff repo, {
  UserRole role = UserRole.owner,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      retry: (_, _) => null,
      overrides: [
        authRepositoryProvider.overrideWithValue(_SignedIn(role)),
        dashboardRepositoryProvider.overrideWithValue(_Dashboard()),
        staffRepositoryProvider.overrideWithValue(repo),
        pendingConversationsCountProvider.overrideWith((ref) async => 0),
        upcomingAppointmentsProvider.overrideWith((ref) async => []),
      ],
      child: const CitaGoApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Más'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Profesionales'));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  testWidgets('lists professionals with an inactive badge', (tester) async {
    await _openStaff(
      tester,
      _FakeStaff(const [
        StaffMember(id: 'a', displayName: 'Carlos', active: true),
        StaffMember(id: 'b', displayName: 'Luis', active: false),
      ]),
    );

    expect(find.text('Carlos'), findsOneWidget);
    expect(find.text('Luis'), findsOneWidget);
    expect(find.text('Activo'), findsOneWidget);
    expect(find.text('Inactivo'), findsOneWidget);
  });

  testWidgets('shows the empty state when there are no professionals', (
    tester,
  ) async {
    await _openStaff(tester, _FakeStaff(const []));
    expect(find.textContaining('Aún no hay profesionales'), findsOneWidget);
  });

  testWidgets('creating a professional sends the display name', (tester) async {
    final repo = _FakeStaff(const []);
    await _openStaff(tester, repo);

    await tester.tap(find.text('Nuevo'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Carlos');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(repo.created?.displayName, 'Carlos');
    expect(find.text('Horario semanal'), findsWidgets);
  });

  testWidgets('the create form requires a name', (tester) async {
    final repo = _FakeStaff(const []);
    await _openStaff(tester, repo);

    await tester.tap(find.text('Nuevo'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Escribe el nombre'), findsOneWidget);
    expect(repo.created, isNull);
  });

  testWidgets('the schedule editor rejects overlapping ranges', (tester) async {
    final repo = _FakeStaff(const [
      StaffMember(
        id: 'a',
        displayName: 'Carlos',
        active: true,
        schedule: [
          ScheduleRange(weekday: 1, startsAt: '09:00', endsAt: '13:00'),
          ScheduleRange(weekday: 1, startsAt: '12:00', endsAt: '18:00'),
        ],
      ),
    ]);
    await _openStaff(tester, repo);

    await tester.tap(find.text('Carlos'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Horario semanal'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Guardar horario'));
    await tester.pumpAndSettle();

    expect(find.textContaining('se solapan'), findsOneWidget);
    expect(repo.replacedSchedule, isNull);
  });

  testWidgets('the schedule editor sends the correct payload', (tester) async {
    final repo = _FakeStaff(const [
      StaffMember(
        id: 'a',
        displayName: 'Carlos',
        active: true,
        schedule: [
          ScheduleRange(weekday: 1, startsAt: '09:00', endsAt: '13:00'),
          ScheduleRange(weekday: 3, startsAt: '10:00', endsAt: '14:00'),
        ],
      ),
    ]);
    await _openStaff(tester, repo);

    await tester.tap(find.text('Carlos'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Horario semanal'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Guardar horario'));
    await tester.pumpAndSettle();

    expect(repo.replacedSchedule, [
      {'weekday': 1, 'startsAt': '09:00', 'endsAt': '13:00'},
      {'weekday': 3, 'startsAt': '10:00', 'endsAt': '14:00'},
    ]);
  });

  testWidgets('adding time off sends UTC instants', (tester) async {
    final repo = _FakeStaff(const [
      StaffMember(id: 'a', displayName: 'Carlos', active: true),
    ]);
    await _openStaff(tester, repo);

    await tester.tap(find.text('Carlos'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ausencias'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Agregar'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Agregar'));
    await tester.pumpAndSettle();

    expect(repo.addedStart, isNotNull);
    expect(repo.addedStart!.isUtc, isTrue);
    expect(repo.addedEnd!.isUtc, isTrue);
    expect(
      repo.addedEnd!.difference(repo.addedStart!),
      const Duration(hours: 24),
    );
  });

  testWidgets('deleting a time off asks the repository to remove it', (
    tester,
  ) async {
    final clock = BusinessClock('America/Lima');
    final start = clock.dayRangeUtc(clock.addDays(clock.today(), 10)).from;
    final end = clock.dayRangeUtc(clock.addDays(clock.today(), 12)).to;
    final repo =
        _FakeStaff(const [
            StaffMember(id: 'a', displayName: 'Carlos', active: true),
          ])
          ..timeOff.add(
            TimeOff(
              id: 'to-1',
              staffMemberId: 'a',
              startsAt: start,
              endsAt: end,
              reason: 'Vacaciones',
            ),
          );
    await _openStaff(tester, repo);

    await tester.tap(find.text('Carlos'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ausencias'));
    await tester.pumpAndSettle();

    expect(find.text('Vacaciones'), findsOneWidget);

    await tester.tap(find.byTooltip('Quitar'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Quitar'));
    await tester.pumpAndSettle();

    expect(repo.removedTimeOff, ['to-1']);
  });

  testWidgets('deactivating a professional calls deactivate', (tester) async {
    final repo = _FakeStaff(const [
      StaffMember(id: 'a', displayName: 'Carlos', active: true),
    ]);
    await _openStaff(tester, repo);

    await tester.tap(find.text('Carlos'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Desactivar'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Desactivar'));
    await tester.pumpAndSettle();

    expect(repo.deactivated, ['a']);
    expect(find.text('Reactivar'), findsOneWidget);
  });

  testWidgets('the AP-19 note is shown on the time off screen', (tester) async {
    final repo = _FakeStaff(const [
      StaffMember(id: 'a', displayName: 'Carlos', active: true),
    ]);
    await _openStaff(tester, repo);

    await tester.tap(find.text('Carlos'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ausencias'));
    await tester.pumpAndSettle();

    expect(find.textContaining('no se cancelan'), findsOneWidget);
  });
}
