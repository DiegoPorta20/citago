import 'package:flutter/material.dart';

class ReplyComposer extends StatelessWidget {
  const ReplyComposer({
    super.key,
    required this.controller,
    required this.enabled,
    required this.sending,
    required this.onSend,
    this.disabledMessage,
  });

  final TextEditingController controller;
  final bool enabled;
  final bool sending;
  final VoidCallback onSend;

  final String? disabledMessage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (!enabled) {
      return SafeArea(
        top: false,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          color: theme.colorScheme.surfaceContainerHighest,
          child: Row(
            children: [
              Icon(
                Icons.lock_clock_outlined,
                size: 20,
                color: theme.colorScheme.outline,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  disabledMessage ??
                      'Pasaron más de 24 horas desde el último mensaje del '
                          'cliente: ya no se puede responder con texto libre.',
                  style: theme.textTheme.bodySmall,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                enabled: !sending,
                decoration: const InputDecoration(
                  hintText: 'Escribe una respuesta',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(width: 4),
            IconButton.filled(
              tooltip: 'Enviar',
              iconSize: 24,
              constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
              onPressed: sending ? null : onSend,
              icon: sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
            ),
          ],
        ),
      ),
    );
  }
}
