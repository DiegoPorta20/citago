import 'package:citagof/core/errors/app_failure.dart';
import 'package:citagof/core/network/api_response.dart';
import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/conversations/domain/entities/conversation.dart';
import 'package:citagof/features/conversations/domain/entities/message.dart';
import 'package:citagof/features/conversations/domain/repositories/conversation_repository.dart';
import 'package:citagof/features/conversations/presentation/pages/conversation_thread_page.dart';
import 'package:citagof/features/conversations/presentation/pages/inbox_page.dart';
import 'package:citagof/features/conversations/presentation/providers/conversation_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeConversationRepository implements ConversationRepository {
  FakeConversationRepository({
    List<Conversation>? inboxItems,
    this.conversation,
    List<Message>? history,
    this.replyError,
  }) : inboxItems = inboxItems ?? const [],
       history = history ?? const [];

  List<Conversation> inboxItems;
  Conversation? conversation;
  List<Message> history;
  AppFailure? replyError;

  final List<String> calls = [];
  InboxFilter? lastFilter;

  @override
  Future<Paged<Conversation>> inbox({
    required InboxFilter filter,
    int page = 1,
    int limit = 20,
  }) async {
    lastFilter = filter;
    calls.add('inbox:${filter.name}');
    return Paged(
      items: inboxItems,
      page: 1,
      limit: limit,
      total: inboxItems.length,
      totalPages: 1,
    );
  }

  @override
  Future<Conversation> get(String id) async => conversation!;

  @override
  Future<MessagePage> messages(
    String id, {
    String? before,
    int limit = 50,
  }) async {
    return MessagePage(items: history.reversed.toList(), hasMore: false);
  }

  @override
  Future<Message> reply(String id, String body) async {
    calls.add('reply:$body');
    if (replyError != null) throw replyError!;
    final message = Message(
      id: 'sent-${history.length}',
      direction: MessageDirection.outbound,
      type: MessageType.text,
      body: body,
      sentAt: DateTime.utc(2026, 10, 20, 12),
    );
    history = [...history, message];
    return message;
  }

  @override
  Future<Conversation> resolve(String id) async {
    calls.add('resolve');
    return conversation!;
  }

  @override
  Future<Conversation> archive(String id) async {
    calls.add('archive');
    return conversation!;
  }

  @override
  Future<Conversation> reopen(String id) async {
    calls.add('reopen');
    return conversation!;
  }

  @override
  Future<Conversation> linkClient(String id, String? clientId) async {
    calls.add('link:$clientId');
    return conversation!;
  }

  @override
  Future<Conversation> assign(String id, String? userId) async {
    calls.add('assign:$userId');
    return conversation!;
  }
}

class FakeSessionController extends SessionController {
  FakeSessionController(this._session);
  final AuthSession _session;

  @override
  Future<AuthSession?> build() async => _session;
}

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

Message _msg(
  String id,
  MessageDirection direction,
  String body,
  DateTime sentAt,
) => Message(
  id: id,
  direction: direction,
  type: MessageType.text,
  body: body,
  sentAt: sentAt,
);

Conversation _conversation({
  bool needsReply = true,
  ConversationStatus status = ConversationStatus.open,
  ConversationClient? client,
}) => Conversation(
  id: 'c1',
  channel: ConversationChannel.whatsapp,
  contactIdentifier: '+51999999999',
  contactName: 'Juan',
  client: client,
  status: status,
  needsReply: needsReply,
  lastMessageAt: DateTime.utc(2026, 10, 20, 11),
  lastMessagePreview: 'Hola',
);

Future<void> _pump(
  WidgetTester tester,
  Widget child,
  FakeConversationRepository repo, {
  UserRole role = UserRole.owner,
  DateTime? now,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        conversationRepositoryProvider.overrideWithValue(repo),
        sessionControllerProvider.overrideWith(
          () => FakeSessionController(_session(role)),
        ),
        if (now != null) nowProvider.overrideWithValue(() => now),
      ],
      child: MaterialApp(home: child),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  group('Inbox', () {
    testWidgets('loads the pending filter by default', (tester) async {
      final repo = FakeConversationRepository(
        inboxItems: [_conversation(needsReply: true)],
      );
      await _pump(tester, const InboxPage(), repo);

      expect(repo.lastFilter, InboxFilter.pending);
      expect(find.text('Juan'), findsOneWidget);
    });

    testWidgets('flags a needs-reply conversation and shows "Sin vincular"', (
      tester,
    ) async {
      final repo = FakeConversationRepository(
        inboxItems: [_conversation(needsReply: true, client: null)],
      );
      await _pump(tester, const InboxPage(), repo);

      expect(find.text('Sin vincular'), findsOneWidget);
      final title = tester.widget<Text>(find.text('Juan'));
      expect(title.style?.fontWeight, FontWeight.w700);
    });

    testWidgets('shows "Archivadas" chip for OWNER/ADMIN', (tester) async {
      final repo = FakeConversationRepository(inboxItems: const []);
      await _pump(tester, const InboxPage(), repo, role: UserRole.owner);
      expect(find.text('Archivadas'), findsOneWidget);
    });

    testWidgets('hides "Archivadas" chip for STAFF', (tester) async {
      final repo = FakeConversationRepository(inboxItems: const []);
      await _pump(tester, const InboxPage(), repo, role: UserRole.staff);
      expect(find.text('Archivadas'), findsNothing);
    });
  });

  group('Thread', () {
    final morning = DateTime.utc(2026, 10, 20, 9);
    final now = DateTime.utc(2026, 10, 20, 12);

    testWidgets('shows messages oldest-to-newest', (tester) async {
      final repo = FakeConversationRepository(
        conversation: _conversation(),
        history: [
          _msg('m1', MessageDirection.inbound, 'Primero', morning),
          _msg(
            'm2',
            MessageDirection.outbound,
            'Segundo',
            morning.add(const Duration(minutes: 5)),
          ),
        ],
      );
      await _pump(
        tester,
        const ConversationThreadPage(conversationId: 'c1'),
        repo,
        now: now,
      );

      final first = tester.getTopLeft(find.text('Primero')).dy;
      final second = tester.getTopLeft(find.text('Segundo')).dy;
      expect(first, lessThan(second));
    });

    testWidgets('sending a reply clears the composer', (tester) async {
      final repo = FakeConversationRepository(
        conversation: _conversation(),
        history: [_msg('m1', MessageDirection.inbound, 'Hola', morning)],
      );
      await _pump(
        tester,
        const ConversationThreadPage(conversationId: 'c1'),
        repo,
        now: now,
      );

      await tester.enterText(find.byType(TextField), 'Buenas, sí hay turno');
      await tester.tap(find.byIcon(Icons.send_rounded));
      await tester.pumpAndSettle();

      expect(repo.calls, contains('reply:Buenas, sí hay turno'));
      expect(
        find.widgetWithText(TextField, 'Buenas, sí hay turno'),
        findsNothing,
      );
    });

    testWidgets('a failed reply keeps the typed text', (tester) async {
      final repo = FakeConversationRepository(
        conversation: _conversation(),
        history: [_msg('m1', MessageDirection.inbound, 'Hola', morning)],
        replyError: const AppFailure(
          message: 'No se pudo enviar el mensaje. Inténtalo de nuevo.',
          code: 'MESSAGE_DELIVERY_FAILED',
        ),
      );
      await _pump(
        tester,
        const ConversationThreadPage(conversationId: 'c1'),
        repo,
        now: now,
      );

      await tester.enterText(find.byType(TextField), 'Reintentar esto');
      await tester.tap(find.byIcon(Icons.send_rounded));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(TextField, 'Reintentar esto'), findsOneWidget);
    });

    testWidgets('the composer is disabled when the 24h window is closed', (
      tester,
    ) async {
      final stale = DateTime.utc(2026, 10, 18, 9);
      final repo = FakeConversationRepository(
        conversation: _conversation(),
        history: [_msg('m1', MessageDirection.inbound, 'Hola', stale)],
      );
      await _pump(
        tester,
        const ConversationThreadPage(conversationId: 'c1'),
        repo,
        now: now,
      );

      expect(find.byType(TextField), findsNothing);
      expect(find.textContaining('24 horas'), findsOneWidget);
    });

    testWidgets('resolve calls the API', (tester) async {
      final repo = FakeConversationRepository(
        conversation: _conversation(needsReply: true),
        history: [_msg('m1', MessageDirection.inbound, 'Hola', morning)],
      );
      await _pump(
        tester,
        const ConversationThreadPage(conversationId: 'c1'),
        repo,
        now: now,
      );

      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Marcar resuelta'));
      await tester.pumpAndSettle();

      expect(repo.calls, contains('resolve'));
    });

    testWidgets('archive is visible for OWNER/ADMIN', (tester) async {
      final ownerRepo = FakeConversationRepository(
        conversation: _conversation(),
        history: [_msg('m1', MessageDirection.inbound, 'Hola', morning)],
      );
      await _pump(
        tester,
        const ConversationThreadPage(conversationId: 'c1'),
        ownerRepo,
        role: UserRole.owner,
        now: now,
      );
      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pumpAndSettle();
      expect(find.text('Archivar'), findsOneWidget);
    });

    testWidgets('archive is hidden for STAFF', (tester) async {
      final staffRepo = FakeConversationRepository(
        conversation: _conversation(),
        history: [_msg('m1', MessageDirection.inbound, 'Hola', morning)],
      );
      await _pump(
        tester,
        const ConversationThreadPage(conversationId: 'c1'),
        staffRepo,
        role: UserRole.staff,
        now: now,
      );
      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pumpAndSettle();
      expect(find.text('Archivar'), findsNothing);
    });
  });
}
