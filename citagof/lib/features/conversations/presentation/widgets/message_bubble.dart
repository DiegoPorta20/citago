import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/message.dart';

class MessageBubble extends ConsumerWidget {
  const MessageBubble({super.key, required this.message});

  final Message message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final clock = ref.watch(businessClockProvider);
    final outbound = message.direction.isOutbound;

    final bubbleColor = outbound
        ? theme.colorScheme.primaryContainer
        : theme.colorScheme.surfaceContainerHighest;
    final textColor = outbound
        ? theme.colorScheme.onPrimaryContainer
        : theme.colorScheme.onSurface;

    final text = message.type.isText
        ? (message.body ?? '')
        : _placeholderFor(message.type);

    return Align(
      alignment: outbound ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.78,
        ),
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
        decoration: BoxDecoration(
          color: bubbleColor,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              text,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: textColor,
                fontStyle: message.type.isText
                    ? FontStyle.normal
                    : FontStyle.italic,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              clock.timeOf(message.sentAt),
              style: theme.textTheme.labelSmall?.copyWith(
                color: textColor.withValues(alpha: 0.7),
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
