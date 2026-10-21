import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/client.dart';
import '../clients_routes.dart';
import '../providers/client_providers.dart';
import '../widgets/client_avatar.dart';

class ClientDetailPage extends ConsumerWidget {
  const ClientDetailPage({super.key, required this.clientId});

  final String clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final client = ref.watch(clientDetailProvider(clientId));
    final canDelete =
        ref.watch(sessionControllerProvider).value?.role.managesBusiness ??
        false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cliente'),
        actions: [
          if (client.hasValue)
            IconButton(
              tooltip: 'Editar',
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => context.push(ClientRoutes.edit(clientId)),
            ),
          if (client.hasValue && canDelete)
            IconButton(
              tooltip: 'Eliminar',
              icon: const Icon(Icons.delete_outline),
              onPressed: () =>
                  _confirmDelete(context, ref, client.requireValue),
            ),
        ],
      ),
      body: client.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(clientDetailProvider(clientId)),
        ),
        data: (data) => _Body(client: data),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    Client client,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Eliminar cliente?'),
        content: Text(
          '${client.name} dejará de aparecer en la lista, pero su historial '
          'se conserva y puedes restaurarlo después.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(deleteClientUseCaseProvider)(client.id);
    } on Object catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(failureMessage(error))));
      return;
    }
    ref.invalidate(clientsListProvider);
    if (context.mounted) context.pop();
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.client});

  final Client client;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Center(child: ClientAvatar(client: client, radius: 36)),
        const SizedBox(height: 12),
        Text(
          client.name,
          textAlign: TextAlign.center,
          style: theme.textTheme.headlineSmall,
        ),
        const SizedBox(height: 24),
        _InfoRow(
          icon: Icons.phone_outlined,
          label: 'Teléfono',
          value: client.phone,
        ),
        _InfoRow(
          icon: Icons.email_outlined,
          label: 'Correo',
          value: client.email,
        ),
        _InfoRow(
          icon: Icons.notes_outlined,
          label: 'Notas',
          value: client.notes,
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon),
      title: Text(label),
      subtitle: Text(value == null || value!.isEmpty ? 'Sin datos' : value!),
    );
  }
}
