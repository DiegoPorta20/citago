import '../../../../core/network/api_response.dart';
import '../entities/conversation.dart';
import '../entities/message.dart';

enum InboxFilter { pending, all, archived }

class MessagePage {
  const MessagePage({
    required this.items,
    required this.hasMore,
    this.nextBefore,
  });

  final List<Message> items;
  final bool hasMore;
  final String? nextBefore;
}

abstract class ConversationRepository {
  Future<Paged<Conversation>> inbox({
    required InboxFilter filter,
    int page = 1,
    int limit = 20,
  });

  Future<Conversation> get(String id);

  Future<MessagePage> messages(String id, {String? before, int limit = 50});

  Future<Message> reply(String id, String body);

  Future<Conversation> resolve(String id);

  Future<Conversation> archive(String id);

  Future<Conversation> reopen(String id);

  Future<Conversation> linkClient(String id, String? clientId);

  Future<Conversation> assign(String id, String? userId);
}
