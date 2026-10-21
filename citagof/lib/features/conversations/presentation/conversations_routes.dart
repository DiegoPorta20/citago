import 'package:go_router/go_router.dart';

import 'pages/conversation_thread_page.dart';
import 'pages/inbox_page.dart';

abstract final class ConversationRoutes {
  static const list = '/conversaciones';
  static String detail(String id) => '/conversaciones/$id';
}

final List<RouteBase> conversationsRoutes = [
  GoRoute(
    path: ConversationRoutes.list,
    builder: (context, state) => const InboxPage(),
    routes: [
      GoRoute(
        path: ':id',
        builder: (context, state) =>
            ConversationThreadPage(conversationId: state.pathParameters['id']!),
      ),
    ],
  ),
];
