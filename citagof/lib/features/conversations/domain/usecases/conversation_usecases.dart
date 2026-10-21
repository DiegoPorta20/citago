import '../../../../core/network/api_response.dart';
import '../entities/conversation.dart';
import '../entities/message.dart';
import '../repositories/conversation_repository.dart';

class ListInboxUseCase {
  const ListInboxUseCase(this._repository);

  final ConversationRepository _repository;

  Future<Paged<Conversation>> call({
    required InboxFilter filter,
    int page = 1,
    int limit = 20,
  }) => _repository.inbox(filter: filter, page: page, limit: limit);
}

class GetConversationUseCase {
  const GetConversationUseCase(this._repository);

  final ConversationRepository _repository;

  Future<Conversation> call(String id) => _repository.get(id);
}

class ListMessagesUseCase {
  const ListMessagesUseCase(this._repository);

  final ConversationRepository _repository;

  Future<MessagePage> call(String id, {String? before, int limit = 50}) =>
      _repository.messages(id, before: before, limit: limit);
}

class SendReplyUseCase {
  const SendReplyUseCase(this._repository);

  final ConversationRepository _repository;

  Future<Message> call(String id, String body) =>
      _repository.reply(id, body.trim());
}

class ResolveConversationUseCase {
  const ResolveConversationUseCase(this._repository);

  final ConversationRepository _repository;

  Future<Conversation> call(String id) => _repository.resolve(id);
}

class ArchiveConversationUseCase {
  const ArchiveConversationUseCase(this._repository);

  final ConversationRepository _repository;

  Future<Conversation> call(String id) => _repository.archive(id);
}

class ReopenConversationUseCase {
  const ReopenConversationUseCase(this._repository);

  final ConversationRepository _repository;

  Future<Conversation> call(String id) => _repository.reopen(id);
}

class LinkConversationClientUseCase {
  const LinkConversationClientUseCase(this._repository);

  final ConversationRepository _repository;

  Future<Conversation> call(String id, String? clientId) =>
      _repository.linkClient(id, clientId);
}

class AssignConversationUseCase {
  const AssignConversationUseCase(this._repository);

  final ConversationRepository _repository;

  Future<Conversation> call(String id, String? userId) =>
      _repository.assign(id, userId);
}
