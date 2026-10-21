import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_response.dart';
import '../../../../core/network/providers.dart';
import '../../data/repositories/client_repository_impl.dart';
import '../../domain/entities/client.dart';
import '../../domain/repositories/client_repository.dart';
import '../../domain/usecases/client_usecases.dart';

final clientRepositoryProvider = Provider<ClientRepository>(
  (ref) => ClientRepositoryImpl(ref.watch(dioProvider)),
);

final listClientsUseCaseProvider = Provider(
  (ref) => ListClientsUseCase(ref.watch(clientRepositoryProvider)),
);
final getClientUseCaseProvider = Provider(
  (ref) => GetClientUseCase(ref.watch(clientRepositoryProvider)),
);
final createClientUseCaseProvider = Provider(
  (ref) => CreateClientUseCase(ref.watch(clientRepositoryProvider)),
);
final updateClientUseCaseProvider = Provider(
  (ref) => UpdateClientUseCase(ref.watch(clientRepositoryProvider)),
);
final deleteClientUseCaseProvider = Provider(
  (ref) => DeleteClientUseCase(ref.watch(clientRepositoryProvider)),
);
final restoreClientUseCaseProvider = Provider(
  (ref) => RestoreClientUseCase(ref.watch(clientRepositoryProvider)),
);

class ClientsListState {
  const ClientsListState({
    required this.items,
    required this.query,
    required this.hasMore,
    this.loadingMore = false,
    this.loadMoreFailed = false,
    this.refreshing = false,
  });

  final List<Client> items;
  final String query;
  final bool hasMore;
  final bool loadingMore;
  final bool loadMoreFailed;

  final bool refreshing;

  ClientsListState copyWith({
    List<Client>? items,
    bool? hasMore,
    bool? loadingMore,
    bool? loadMoreFailed,
    bool? refreshing,
  }) => ClientsListState(
    items: items ?? this.items,
    query: query,
    hasMore: hasMore ?? this.hasMore,
    loadingMore: loadingMore ?? this.loadingMore,
    loadMoreFailed: loadMoreFailed ?? this.loadMoreFailed,
    refreshing: refreshing ?? this.refreshing,
  );
}

const _pageSize = 20;

class ClientsListController extends AsyncNotifier<ClientsListState> {
  int _page = 1;
  int _generation = 0;

  @override
  Future<ClientsListState> build() => _firstPage('');

  Future<ClientsListState> _firstPage(String query) async {
    _page = 1;
    final page = await ref.read(listClientsUseCaseProvider)(
      query: query,
      limit: _pageSize,
    );
    return ClientsListState(
      items: page.items,
      query: query,
      hasMore: page.hasMore,
    );
  }

  Future<void> search(String query) async {
    final generation = ++_generation;
    final previous = state.value;
    if (previous != null) {
      state = AsyncData(previous.copyWith(refreshing: true));
    } else {
      state = const AsyncLoading();
    }
    final next = await AsyncValue.guard(() => _firstPage(query));
    if (generation != _generation) return;
    if (next.hasError && previous != null) {
      state = AsyncData(previous.copyWith(refreshing: false));
    } else {
      state = next;
    }
  }

  Future<void> refresh() => search(state.value?.query ?? '');

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingMore) return;

    state = AsyncData(
      current.copyWith(loadingMore: true, loadMoreFailed: false),
    );
    final generation = _generation;
    try {
      final page = await ref.read(listClientsUseCaseProvider)(
        query: current.query,
        page: _page + 1,
        limit: _pageSize,
      );
      if (generation != _generation) return;
      _page++;
      state = AsyncData(
        current.copyWith(
          items: [...current.items, ...page.items],
          hasMore: page.hasMore,
          loadingMore: false,
        ),
      );
    } on Object {
      if (generation != _generation) return;
      state = AsyncData(
        current.copyWith(loadingMore: false, loadMoreFailed: true),
      );
    }
  }
}

final clientsListProvider =
    AsyncNotifierProvider.autoDispose<ClientsListController, ClientsListState>(
      ClientsListController.new,
    );

final clientDetailProvider = FutureProvider.autoDispose.family<Client, String>(
  (ref, id) => ref.watch(getClientUseCaseProvider)(id),
);

final clientSearchProvider = FutureProvider.autoDispose
    .family<Paged<Client>, String>(
      (ref, query) => ref.watch(listClientsUseCaseProvider)(query: query),
    );
