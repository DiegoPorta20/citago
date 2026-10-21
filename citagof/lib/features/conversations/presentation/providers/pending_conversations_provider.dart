import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/repositories/conversation_repository.dart';
import 'conversation_providers.dart';

final pendingConversationsCountProvider = FutureProvider.autoDispose<int>((
  ref,
) async {
  final page = await ref.watch(listInboxUseCaseProvider)(
    filter: InboxFilter.pending,
    limit: 1,
  );
  return page.total;
});
