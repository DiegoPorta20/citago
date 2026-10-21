import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/providers.dart';
import '../../data/repositories/conversation_repository_impl.dart';
import '../../domain/entities/conversation.dart';
import '../../domain/entities/message.dart';
import '../../domain/repositories/conversation_repository.dart';
import '../../domain/usecases/conversation_usecases.dart';

final conversationRepositoryProvider = Provider<ConversationRepository>(
  (ref) => ConversationRepositoryImpl(ref.watch(dioProvider)),
);

final nowProvider = Provider<DateTime Function()>((ref) => DateTime.now);

final listInboxUseCaseProvider = Provider(
  (ref) => ListInboxUseCase(ref.watch(conversationRepositoryProvider)),
);
final getConversationUseCaseProvider = Provider(
  (ref) => GetConversationUseCase(ref.watch(conversationRepositoryProvider)),
);
final listMessagesUseCaseProvider = Provider(
  (ref) => ListMessagesUseCase(ref.watch(conversationRepositoryProvider)),
);
final sendReplyUseCaseProvider = Provider(
  (ref) => SendReplyUseCase(ref.watch(conversationRepositoryProvider)),
);
final resolveConversationUseCaseProvider = Provider(
  (ref) =>
      ResolveConversationUseCase(ref.watch(conversationRepositoryProvider)),
);
final archiveConversationUseCaseProvider = Provider(
  (ref) =>
      ArchiveConversationUseCase(ref.watch(conversationRepositoryProvider)),
);
final reopenConversationUseCaseProvider = Provider(
  (ref) => ReopenConversationUseCase(ref.watch(conversationRepositoryProvider)),
);
final linkConversationClientUseCaseProvider = Provider(
  (ref) =>
      LinkConversationClientUseCase(ref.watch(conversationRepositoryProvider)),
);
final assignConversationUseCaseProvider = Provider(
  (ref) => AssignConversationUseCase(ref.watch(conversationRepositoryProvider)),
);

class InboxFilterController extends Notifier<InboxFilter> {
  @override
  InboxFilter build() => InboxFilter.pending;

  void select(InboxFilter filter) => state = filter;
}

final inboxFilterProvider =
    NotifierProvider<InboxFilterController, InboxFilter>(
      InboxFilterController.new,
    );

class InboxState {
  const InboxState({
    required this.items,
    required this.filter,
    required this.hasMore,
    this.loadingMore = false,
    this.loadMoreFailed = false,
    this.refreshing = false,
  });

  final List<Conversation> items;
  final InboxFilter filter;
  final bool hasMore;
  final bool loadingMore;
  final bool loadMoreFailed;

  final bool refreshing;

  InboxState copyWith({
    List<Conversation>? items,
    bool? hasMore,
    bool? loadingMore,
    bool? loadMoreFailed,
    bool? refreshing,
  }) => InboxState(
    items: items ?? this.items,
    filter: filter,
    hasMore: hasMore ?? this.hasMore,
    loadingMore: loadingMore ?? this.loadingMore,
    loadMoreFailed: loadMoreFailed ?? this.loadMoreFailed,
    refreshing: refreshing ?? this.refreshing,
  );
}

const _inboxPageSize = 20;

class InboxController extends AsyncNotifier<InboxState> {
  int _page = 1;

  @override
  Future<InboxState> build() {
    final filter = ref.watch(inboxFilterProvider);
    return _firstPage(filter);
  }

  Future<InboxState> _firstPage(InboxFilter filter) async {
    _page = 1;
    final page = await ref.read(listInboxUseCaseProvider)(
      filter: filter,
      limit: _inboxPageSize,
    );
    return InboxState(items: page.items, filter: filter, hasMore: page.hasMore);
  }

  Future<void> refresh() async {
    final current = state.value;
    if (current == null) {
      state = const AsyncLoading();
      state = await AsyncValue.guard(
        () => _firstPage(ref.read(inboxFilterProvider)),
      );
      return;
    }
    state = AsyncData(current.copyWith(refreshing: true));
    final next = await AsyncValue.guard(() => _firstPage(current.filter));
    if (next.hasError) {
      state = AsyncData(current.copyWith(refreshing: false));
    } else {
      state = next;
    }
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingMore) return;

    state = AsyncData(
      current.copyWith(loadingMore: true, loadMoreFailed: false),
    );
    try {
      final page = await ref.read(listInboxUseCaseProvider)(
        filter: current.filter,
        page: _page + 1,
        limit: _inboxPageSize,
      );
      _page++;
      state = AsyncData(
        current.copyWith(
          items: [...current.items, ...page.items],
          hasMore: page.hasMore,
          loadingMore: false,
        ),
      );
    } on Object {
      state = AsyncData(
        current.copyWith(loadingMore: false, loadMoreFailed: true),
      );
    }
  }
}

final inboxProvider =
    AsyncNotifierProvider.autoDispose<InboxController, InboxState>(
      InboxController.new,
    );

final conversationProvider = FutureProvider.autoDispose
    .family<Conversation, String>(
      (ref, id) => ref.watch(getConversationUseCaseProvider)(id),
    );

class ThreadState {
  const ThreadState({
    required this.messages,
    required this.hasMore,
    this.loadingMore = false,
    this.loadMoreFailed = false,
  });

  final List<Message> messages;
  final bool hasMore;
  final bool loadingMore;
  final bool loadMoreFailed;

  ThreadState copyWith({
    List<Message>? messages,
    bool? hasMore,
    bool? loadingMore,
    bool? loadMoreFailed,
  }) => ThreadState(
    messages: messages ?? this.messages,
    hasMore: hasMore ?? this.hasMore,
    loadingMore: loadingMore ?? this.loadingMore,
    loadMoreFailed: loadMoreFailed ?? this.loadMoreFailed,
  );

  DateTime? get lastInboundAt => lastInboundAtOf(messages);
}

DateTime? lastInboundAtOf(Iterable<Message> messages) =>
    lastInboundAt(messages);

const _messagesPageSize = 50;

class ThreadController extends AsyncNotifier<ThreadState> {
  ThreadController(this._conversationId);

  final String _conversationId;

  @override
  Future<ThreadState> build() => _firstPage();

  Future<ThreadState> _firstPage() async {
    final page = await ref.read(listMessagesUseCaseProvider)(
      _conversationId,
      limit: _messagesPageSize,
    );
    return ThreadState(
      messages: page.items.reversed.toList(),
      hasMore: page.hasMore,
    );
  }

  Future<void> loadOlder() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingMore) return;
    final oldest = current.messages.isEmpty ? null : current.messages.first.id;

    state = AsyncData(
      current.copyWith(loadingMore: true, loadMoreFailed: false),
    );
    try {
      final page = await ref.read(listMessagesUseCaseProvider)(
        _conversationId,
        before: oldest,
        limit: _messagesPageSize,
      );
      state = AsyncData(
        current.copyWith(
          messages: [...page.items.reversed, ...current.messages],
          hasMore: page.hasMore,
          loadingMore: false,
        ),
      );
    } on Object {
      state = AsyncData(
        current.copyWith(loadingMore: false, loadMoreFailed: true),
      );
    }
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_firstPage);
  }

  void appendSent(Message message) {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(
      current.copyWith(messages: [...current.messages, message]),
    );
  }
}

final threadProvider = AsyncNotifierProvider.autoDispose
    .family<ThreadController, ThreadState, String>(ThreadController.new);
