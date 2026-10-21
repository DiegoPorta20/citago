import 'package:dio/dio.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/network/api_response.dart';
import '../../domain/entities/conversation.dart';
import '../../domain/entities/message.dart';
import '../../domain/repositories/conversation_repository.dart';
import '../models/conversation_model.dart';

class ConversationRepositoryImpl implements ConversationRepository {
  const ConversationRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<Paged<Conversation>> inbox({
    required InboxFilter filter,
    int page = 1,
    int limit = 20,
  }) => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/conversations',
      queryParameters: {'page': page, 'limit': limit, ..._filterQuery(filter)},
    );
    return unwrapPage(response, conversationFromJson);
  });

  @override
  Future<Conversation> get(String id) => _guard(() async {
    final response = await _dio.get<dynamic>('/conversations/$id');
    return conversationFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<MessagePage> messages(String id, {String? before, int limit = 50}) =>
      _guard(() async {
        final response = await _dio.get<dynamic>(
          '/conversations/$id/messages',
          queryParameters: {'limit': limit, 'before': ?before},
        );
        return _parseMessagePage(response);
      });

  @override
  Future<Message> reply(String id, String body) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/conversations/$id/messages',
      data: sendReplyBody(body),
    );
    return messageFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Conversation> resolve(String id) =>
      _action('/conversations/$id/resolve');

  @override
  Future<Conversation> archive(String id) =>
      _action('/conversations/$id/archive');

  @override
  Future<Conversation> reopen(String id) =>
      _action('/conversations/$id/reopen');

  @override
  Future<Conversation> linkClient(String id, String? clientId) =>
      _guard(() async {
        final response = await _dio.put<dynamic>(
          '/conversations/$id/client',
          data: linkClientBody(clientId),
        );
        return conversationFromJson(unwrapData<Map<String, dynamic>>(response));
      });

  @override
  Future<Conversation> assign(String id, String? userId) => _guard(() async {
    final response = await _dio.put<dynamic>(
      '/conversations/$id/assignee',
      data: assignBody(userId),
    );
    return conversationFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  Future<Conversation> _action(String path) => _guard(() async {
    final response = await _dio.post<dynamic>(path);
    return conversationFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  Map<String, dynamic> _filterQuery(InboxFilter filter) => switch (filter) {
    InboxFilter.pending => {'status': 'OPEN', 'needsReply': 'true'},
    InboxFilter.all => {'status': 'OPEN'},
    InboxFilter.archived => {'status': 'ARCHIVED'},
  };

  MessagePage _parseMessagePage(Response<dynamic> response) {
    final body = response.data;
    if (body is! Map<String, dynamic> || body['data'] is! List<dynamic>) {
      throw const AppFailure(message: 'Respuesta inesperada del servidor.');
    }
    final meta = (body['meta'] as Map<String, dynamic>?) ?? const {};
    final items = [
      for (final row in body['data'] as List<dynamic>)
        messageFromJson(row as Map<String, dynamic>),
    ];
    return MessagePage(
      items: items,
      hasMore: meta['hasMore'] as bool? ?? false,
      nextBefore: meta['nextBefore'] as String?,
    );
  }

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
