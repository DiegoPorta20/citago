import 'package:flutter/material.dart';

import '../theme/app_status_colors.dart';

/// Compact, tinted status indicator. Shape, size and typography are fixed so
/// every status in the app looks like part of the same family; only the tone
/// changes.
class StatusPill extends StatelessWidget {
  const StatusPill({
    super.key,
    required this.label,
    required this.tone,
    this.showDot = true,
  });

  final String label;
  final StatusTone tone;
  final bool showDot;

  @override
  Widget build(BuildContext context) {
    final colors = AppStatusColors.of(context);
    final foreground = colors.foreground(tone);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.background(tone),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showDot) ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: foreground,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: foreground,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
