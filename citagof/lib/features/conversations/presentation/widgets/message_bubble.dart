import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_tokens.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/message.dart';

class MessageBubble extends ConsumerWidget {
  const MessageBubble({super.key, required this.message});

  final Message message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final clock = ref.watch(businessClockProvider);
    final outbound = message.direction.isOutbound;

    final bubbleColor = outbound
        ? scheme.primaryContainer
        : scheme.surfaceContainerHigh;
    final textColor = outbound ? scheme.onPrimaryContainer : scheme.onSurface;

    final text = message.type.isText
        ? (message.body ?? '')
        : _placeholderFor(message.type);

    // The corner next to the sender is squarer, like a chat "tail".
    const big = Radius.circular(18);
    const small = Radius.circular(4);
    final radius = BorderRadius.only(
      topLeft: big,
      topRight: big,
      bottomLeft: outbound ? big : small,
      bottomRight: outbound ? small : big,
    );

    return Align(
      alignment: outbound ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.78,
        ),
        margin: const EdgeInsets.symmetric(
          horizontal: AppSpacing.page,
          vertical: 3,
        ),
        padding: const EdgeInsets.fromLTRB(14, 9, 14, 7),
        decoration: BoxDecoration(
          color: bubbleColor,
          borderRadius: radius,
          border: outbound
              ? Border.all(color: scheme.primary.withValues(alpha: 0.25))
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                text,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: textColor,
                  fontStyle: message.type.isText
                      ? FontStyle.normal
                      : FontStyle.italic,
                ),
              ),
            ),
            const SizedBox(height: 3),
            Text(
              clock.timeOf(message.sentAt),
              style: theme.textTheme.labelSmall?.copyWith(
                color: textColor.withValues(alpha: 0.65),
                fontFeatures: AppText.tabular,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _placeholderFor(MessageType type) => switch (type) {
    MessageType.image => '📷 Imagen',
    MessageType.audio => '🎤 Audio',
    MessageType.video => '🎬 Video',
    MessageType.document => '📄 Documento',
    MessageType.location => '📍 Ubicación',
    MessageType.text || MessageType.other => 'Mensaje no compatible',
  };
}
