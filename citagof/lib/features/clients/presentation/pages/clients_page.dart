import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/client.dart';
import '../clients_routes.dart';
import '../providers/client_providers.dart';
import '../widgets/client_avatar.dart';

class ClientsPage extends ConsumerStatefulWidget {
  const ClientsPage({super.key});

  @override
  ConsumerState<ClientsPage> createState() => _ClientsPageState();
}

class _ClientsPageState extends ConsumerState<ClientsPage> {
  final _scroll = ScrollController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 300) {
        ref.read(clientsListProvider.notifier).loadMore();
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      ref.read(clientsListProvider.notifier).search(value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(clientsListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Clientes')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(ClientRoutes.create),
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('Nuevo'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              onChanged: _onSearchChanged,
              textInputAction: TextInputAction.search,
              decoration: const InputDecoration(
                hintText: 'Buscar por nombre o teléfono',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          if (list.value?.refreshing ?? false)
            const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: list.when(
              skipLoadingOnReload: true,
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => ErrorView(
                error: error,
                onRetry: () => ref.read(clientsListProvider.notifier).refresh(),
              ),
              data: (state) => state.items.isEmpty
                  ? _EmptyState(searching: state.query.isNotEmpty)
                  : RefreshIndicator(
                      onRefresh: () =>
                          ref.read(clientsListProvider.notifier).refresh(),
                      child: ListView.builder(
                        controller: _scroll,
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.only(bottom: 96),
                        itemCount: state.items.length + 1,
                        itemBuilder: (context, index) {
                          if (index == state.items.length) {
                            return _Footer(state: state);
                          }
                          return _ClientTile(client: state.items[index]);
                        },
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ClientTile extends StatelessWidget {
  const _ClientTile({required this.client});

  final Client client;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      minTileHeight: 64,
      leading: ClientAvatar(client: client),
      title: Text(client.name),
      subtitle: client.phone == null ? null : Text(client.phone!),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => context.push(ClientRoutes.detail(client.id)),
    );
  }
}

class _Footer extends ConsumerWidget {
  const _Footer({required this.state});

  final ClientsListState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.loadingMore) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (state.loadMoreFailed) {
      return Padding(
        padding: const EdgeInsets.all(8),
        child: TextButton.icon(
          onPressed: () => ref.read(clientsListProvider.notifier).loadMore(),
          icon: const Icon(Icons.refresh),
          label: const Text('No se pudo cargar más. Reintentar'),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.searching});

  final bool searching;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              searching ? Icons.search_off : Icons.people_outline,
              size: 56,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 12),
            Text(
              searching
                  ? 'No encontramos clientes con esa búsqueda.'
                  : 'Aún no hay clientes. Registra el primero con "Nuevo".',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
