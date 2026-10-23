import 'package:flutter/material.dart';

import '../../../../core/theme/app_tokens.dart';

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
    final scheme = theme.colorScheme;

    final border = Border(top: BorderSide(color: scheme.outlineVariant));

    if (!enabled) {
      return DecoratedBox(
        decoration: BoxDecoration(
          color: scheme.surfaceContainerLow,
          border: border,
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.l),
            child: Row(
              children: [
                Icon(
                  Icons.lock_clock_outlined,
                  size: 22,
                  color: scheme.onSurfaceVariant,
                ),
                const SizedBox(width: AppSpacing.m),
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
        ),
      );
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLow,
        border: border,
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.m,
            AppSpacing.s,
            AppSpacing.s,
            AppSpacing.s,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  minLines: 1,
                  maxLines: 5,
                  textCapitalization: TextCapitalization.sentences,
                  textInputAction: TextInputAction.newline,
                  enabled: !sending,
                  decoration: InputDecoration(
                    hintText: 'Escribe una respuesta',
                    isDense: true,
                    fillColor: scheme.surface,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.l,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide(color: scheme.outlineVariant),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide(color: scheme.outlineVariant),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide(color: scheme.primary, width: 1.5),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.s),
              IconButton.filled(
                tooltip: 'Enviar',
                iconSize: 22,
                style: IconButton.styleFrom(
                  fixedSize: const Size(48, 48),
                  backgroundColor: scheme.primary,
                  foregroundColor: scheme.onPrimary,
                ),
                onPressed: sending ? null : onSend,
                icon: sending
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: scheme.onPrimary,
                        ),
                      )
                    : const Icon(Icons.send_rounded),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
