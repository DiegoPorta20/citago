import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_failure.dart';
import '../../domain/entities/message.dart';
import 'conversation_providers.dart';

sealed class ReplyResult {
  const ReplyResult();
}

class ReplySent extends ReplyResult {
  const ReplySent(this.message);
  final Message message;
}

class ReplyFailed extends ReplyResult {
  const ReplyFailed(this.failure);
  final AppFailure failure;

  bool get windowClosed => failure.code == 'REPLY_WINDOW_CLOSED';
}

class ReplyController extends AsyncNotifier<void> {
  ReplyController(this._conversationId);

  final String _conversationId;

  @override
  Future<void> build() async {}

  Future<ReplyResult> send(String body) async {
    state = const AsyncLoading();
    try {
      final message = await ref.read(sendReplyUseCaseProvider)(
        _conversationId,
        body,
      );
      state = const AsyncData(null);
      return ReplySent(message);
    } on AppFailure catch (failure) {
      state = const AsyncData(null);
      return ReplyFailed(failure);
    } on Object {
      state = const AsyncData(null);
      return const ReplyFailed(
        AppFailure(message: 'Algo salió mal. Inténtalo de nuevo.'),
      );
    }
  }
}

final replyControllerProvider = AsyncNotifierProvider.autoDispose
    .family<ReplyController, void, String>(ReplyController.new);
