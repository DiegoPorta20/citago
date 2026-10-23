import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/time/business_clock.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/info_card.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
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
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.page,
              AppSpacing.s,
              AppSpacing.page,
              AppSpacing.xxxl,
            ),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              _StatusCard(connected: data.connected),
              if (data.connected) ...[
                const SizedBox(height: AppSpacing.l),
                _ConnectionDetails(channel: data),
              ],
              const SizedBox(height: AppSpacing.xxl),
              FilledButton.icon(
                onPressed: () => context.push(WhatsAppRoutes.connect),
                icon: const Icon(Icons.link_rounded),
                label: Text(data.connected ? 'Reconectar' : 'Conectar'),
              ),
              if (data.connected) ...[
                const SizedBox(height: AppSpacing.m),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                    foregroundColor: AppStatusColors.of(context)
                        .foreground(StatusTone.danger),
                    side: BorderSide(
                      color: AppStatusColors.of(context)
                          .foreground(StatusTone.danger)
                          .withValues(alpha: 0.5),
                    ),
                  ),
                  onPressed: () => _confirmDisconnect(context, ref),
                  icon: const Icon(Icons.link_off_rounded),
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

/// Big status card: green and reassuring when connected, neutral otherwise.
class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.connected});

  final bool connected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = AppStatusColors.of(context);
    final tone = connected ? StatusTone.success : StatusTone.neutral;
    final color = colors.foreground(tone);

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.xl),
      borderColor: connected ? color.withValues(alpha: 0.4) : null,
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          colors.background(tone).withValues(alpha: 0.28),
          theme.colorScheme.surfaceContainerLow,
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: colors.background(tone),
              shape: BoxShape.circle,
            ),
            child: Icon(
              connected ? Icons.check_rounded : Icons.link_off_rounded,
              size: 28,
              color: color,
            ),
          ),
          const SizedBox(width: AppSpacing.l),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  connected ? 'Conectado' : 'Sin conectar',
                  style: theme.textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  connected
                      ? 'Recibes y respondes mensajes de tus clientes desde '
                            'la bandeja de conversaciones.'
                      : 'Conecta el número de WhatsApp del negocio para '
                            'recibir y responder los mensajes de tus clientes '
                            'desde aquí.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ConnectionDetails extends ConsumerWidget {
  const _ConnectionDetails({required this.channel});

  final WhatsAppChannel channel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clock = ref.watch(businessClockProvider);
    final connectedAt = channel.connectedAt;

    return InfoCard(
      children: [
        InfoRow(
          icon: Icons.phone_iphone_rounded,
          label: 'Número',
          value: channel.displayPhoneNumber ?? 'Sin dato',
          emphasize: true,
        ),
        if ((channel.verifiedName ?? '').isNotEmpty)
          InfoRow(
            icon: Icons.verified_outlined,
            label: 'Nombre',
            value: channel.verifiedName!,
          ),
        if (connectedAt != null)
          InfoRow(
            icon: Icons.event_available_outlined,
            label: 'Conectado el',
            value:
                '${BusinessClock.longDateCapitalized(clock.dateOf(connectedAt))}, '
                '${clock.timeOf(connectedAt)}',
          ),
      ],
    );
  }
}
