import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/client.dart';
import '../providers/client_providers.dart';
import '../widgets/client_avatar.dart';

Future<Client?> pickClient(BuildContext context) {
  return Navigator.of(
    context,
  ).push<Client>(MaterialPageRoute(builder: (_) => const ClientPickerPage()));
}

class ClientPickerPage extends ConsumerStatefulWidget {
  const ClientPickerPage({super.key});

  @override
  ConsumerState<ClientPickerPage> createState() => _ClientPickerPageState();
}

class _ClientPickerPageState extends ConsumerState<ClientPickerPage> {
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = value.trim());
    });
  }

  @override
  Widget build(BuildContext context) {
    final results = ref.watch(clientSearchProvider(_query));

    return Scaffold(
      appBar: AppBar(title: const Text('Elegir cliente')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              autofocus: true,
              onChanged: _onChanged,
              decoration: const InputDecoration(
                hintText: 'Buscar por nombre o teléfono',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          Expanded(
            child: results.when(
              skipLoadingOnReload: true,
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => ErrorView(
                error: error,
                onRetry: () => ref.invalidate(clientSearchProvider(_query)),
              ),
              data: (page) => page.isEmpty
                  ? const Center(child: Text('Sin resultados'))
                  : ListView.builder(
                      itemCount: page.items.length,
                      itemBuilder: (context, index) {
                        final client = page.items[index];
                        return ListTile(
                          minTileHeight: 64,
                          leading: ClientAvatar(client: client),
                          title: Text(client.name),
                          subtitle: client.phone == null
                              ? null
                              : Text(client.phone!),
                          onTap: () => Navigator.of(context).pop(client),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
