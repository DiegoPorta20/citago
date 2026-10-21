import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../../../core/time/business_clock.dart';
import '../../domain/entities/whatsapp_channel.dart';
import '../providers/whatsapp_providers.dart';
import '../whatsapp_routes.dart';

class WhatsAppChannelPage extends ConsumerWidget {
  const WhatsAppChannelPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final channel = ref.watch(whatsAppChannelProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('WhatsApp')),
      body: channel.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(whatsAppChannelProvider),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(whatsAppChannelProvider),
          child: ListView(
            padding: const EdgeInsets.all(16),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (data.connected)
                _ConnectedCard(channel: data)
              else
                const _DisconnectedCard(),
              const SizedBox(height: 16),
              FilledButton.icon(
                style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
                onPressed: () => context.push(WhatsAppRoutes.connect),
                icon: const Icon(Icons.link),
                label: Text(data.connected ? 'Reconectar' : 'Conectar'),
              ),
              if (data.connected) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 48),
                  ),
                  onPressed: () => _confirmDisconnect(context, ref),
                  icon: const Icon(Icons.link_off),
                  label: const Text('Desconectar'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirmDisconnect(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Desconectar WhatsApp?'),
        content: const Text(
          'Se borrará el token de acceso y dejarás de recibir y responder '
          'mensajes por WhatsApp. Las conversaciones y los mensajes ya '
          'recibidos se conservan. Para volver a usar WhatsApp tendrás que '
          'conectar el número de nuevo con un token.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Desconectar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(disconnectWhatsAppChannelUseCaseProvider)();
    } on Object catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(failureMessage(error))));
      }
      return;
    }
    ref.invalidate(whatsAppChannelProvider);
  }
}

class _ConnectedCard extends ConsumerWidget {
  const _ConnectedCard({required this.channel});

  final WhatsAppChannel channel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final clock = ref.watch(businessClockProvider);
    final connectedAt = channel.connectedAt;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.check_circle, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text('Conectado', style: theme.textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 12),
            _Line(
              label: 'Número',
              value: channel.displayPhoneNumber ?? 'Sin dato',
            ),
            if ((channel.verifiedName ?? '').isNotEmpty)
              _Line(label: 'Nombre', value: channel.verifiedName!),
            if (connectedAt != null)
              _Line(
                label: 'Conectado el',
                value:
                    '${BusinessClock.longDate(clock.dateOf(connectedAt))}, '
                    '${clock.timeOf(connectedAt)}',
              ),
          ],
        ),
      ),
    );
  }
}

class _DisconnectedCard extends StatelessWidget {
  const _DisconnectedCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.link_off, color: theme.colorScheme.outline),
                const SizedBox(width: 8),
                Text('Sin conectar', style: theme.textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Conecta el número de WhatsApp del negocio para recibir y '
              'responder los mensajes de tus clientes desde aquí.',
            ),
          ],
        ),
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: theme.textTheme.labelMedium?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
