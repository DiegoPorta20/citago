import 'package:citagof/core/network/api_response.dart';
import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/conversations/data/models/conversation_model.dart';
import 'package:citagof/features/conversations/domain/entities/conversation.dart';
import 'package:citagof/features/conversations/domain/entities/message.dart';
import 'package:citagof/features/conversations/domain/repositories/conversation_repository.dart';
import 'package:citagof/features/conversations/presentation/pages/conversation_thread_page.dart';
import 'package:citagof/features/conversations/presentation/providers/conversation_providers.dart';
import 'package:citagof/features/team/domain/entities/team_member.dart';
import 'package:citagof/features/team/presentation/providers/team_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeConversationRepository implements ConversationRepository {
  FakeConversationRepository({
    required this.conversation,
    List<Message>? history,
  }) : history = history ?? const [];

  Conversation conversation;
  List<Message> history;
  final List<String> calls = [];

  @override
  Future<Paged<Conversation>> inbox({
    required InboxFilter filter,
    int page = 1,
    int limit = 20,
  }) async => Paged(
    items: [conversation],
    page: 1,
    limit: limit,
    total: 1,
    totalPages: 1,
  );

  @override
  Future<Conversation> get(String id) async => conversation;

  @override
  Future<MessagePage> messages(
    String id, {
    String? before,
    int limit = 50,
  }) async => MessagePage(items: history.reversed.toList(), hasMore: false);

  @override
  Future<Message> reply(String id, String body) async =>
      throw UnimplementedError();

  @override
  Future<Conversation> resolve(String id) async => conversation;

  @override
  Future<Conversation> archive(String id) async => conversation;

  @override
  Future<Conversation> reopen(String id) async => conversation;

  @override
  Future<Conversation> linkClient(String id, String? clientId) async =>
      conversation;

  @override
  Future<Conversation> assign(String id, String? userId) async {
    calls.add('assign:$userId');
    return conversation;
  }
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

Conversation _conversation({
  String? assignedUserId,
  String? assignedUserName,
}) => Conversation(
  id: 'c1',
  channel: ConversationChannel.whatsapp,
  contactIdentifier: '+51999999999',
  contactName: 'Juan',
  assignedUserId: assignedUserId,
  assignedUserName: assignedUserName,
  status: ConversationStatus.open,
  needsReply: true,
  lastMessageAt: DateTime.utc(2026, 10, 20, 11),
  lastMessagePreview: 'Hola',
);

Message _inbound() => Message(
  id: 'm1',
  direction: MessageDirection.inbound,
  type: MessageType.text,
  body: 'Hola',
  sentAt: DateTime.utc(2026, 10, 20, 9),
);

final _members = [
  const TeamMember(
    id: 'm2',
    userId: 'u2',
    name: 'Ana',
    email: 'ana@demo.local',
    role: UserRole.staff,
    status: MembershipStatus.active,
  ),
];

Future<void> _pump(
  WidgetTester tester,
  FakeConversationRepository repo, {
  required UserRole role,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        conversationRepositoryProvider.overrideWithValue(repo),
        teamMembersProvider.overrideWith((ref) async => _members),
        sessionControllerProvider.overrideWith(
          () => FakeSessionController(_session(role)),
        ),
        nowProvider.overrideWithValue(() => DateTime.utc(2026, 10, 20, 12)),
      ],
      child: const MaterialApp(
        home: ConversationThreadPage(conversationId: 'c1'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  group('assignBody', () {
    test('sends the user id, or null to unassign', () {
      expect(assignBody('u2'), {'userId': 'u2'});
      expect(assignBody(null), {'userId': null});
    });
  });

  group('assignment from the thread menu', () {
    testWidgets('STAFF do not see "Asignar"', (tester) async {
      final repo = FakeConversationRepository(
        conversation: _conversation(),
        history: [_inbound()],
      );
      await _pump(tester, repo, role: UserRole.staff);
      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pumpAndSettle();
      expect(find.text('Asignar'), findsNothing);
    });

    testWidgets('OWNER sees "Asignar"', (tester) async {
      final repo = FakeConversationRepository(
        conversation: _conversation(),
        history: [_inbound()],
      );
      await _pump(tester, repo, role: UserRole.owner);
      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pumpAndSettle();
      expect(find.text('Asignar'), findsOneWidget);
    });

    testWidgets('picking a member calls the assignee API', (tester) async {
      final repo = FakeConversationRepository(
        conversation: _conversation(),
        history: [_inbound()],
      );
      await _pump(tester, repo, role: UserRole.owner);

      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Asignar'));
      await tester.pumpAndSettle();

      expect(find.text('Sin asignar'), findsOneWidget);
      await tester.tap(find.text('Ana'));
      await tester.pumpAndSettle();

      expect(repo.calls, contains('assign:u2'));
    });

    testWidgets('the header shows the assignee name from the DTO', (
      tester,
    ) async {
      final repo = FakeConversationRepository(
        conversation: _conversation(
          assignedUserId: 'u2',
          assignedUserName: 'Ana',
        ),
        history: [_inbound()],
      );
      await _pump(tester, repo, role: UserRole.owner);

      expect(find.text('Asignada a Ana'), findsOneWidget);
    });
  });
}
