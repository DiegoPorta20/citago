import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';

/// Header shared by every screen that browses time (agenda, sales): the
/// current period on the left, "Hoy" plus previous/next on the right. Same
/// layout everywhere, so dates always read in the same place.
class PeriodHeader extends StatelessWidget {
  const PeriodHeader({
    super.key,
    required this.title,
    required this.onPrevious,
    required this.onNext,
    required this.previousTooltip,
    required this.nextTooltip,
    this.subtitle,
    this.onTitleTap,
    this.onToday,
  });

  final String title;
  final String? subtitle;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final String previousTooltip;
  final String nextTooltip;

  /// When set, the title becomes a button (e.g. to open a date picker).
  final VoidCallback? onTitleTap;

  /// When set, a "Hoy" shortcut is shown. Pass null while already on today.
  final VoidCallback? onToday;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    final heading = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleLarge,
              ),
            ),
            if (onTitleTap != null) ...[
              const SizedBox(width: 2),
              Icon(
                Icons.expand_more_rounded,
                size: 22,
                color: scheme.onSurfaceVariant,
              ),
            ],
          ],
        ),
        if (subtitle != null)
          Text(
            subtitle!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall,
          ),
      ],
    );

    return Row(
      children: [
        Expanded(
          child: onTitleTap == null
              ? heading
              : InkWell(
                  onTap: onTitleTap,
                  borderRadius: BorderRadius.circular(AppRadius.chip),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: heading,
                  ),
                ),
        ),
        if (onToday != null) ...[
          FilledButton.tonal(
            onPressed: onToday,
            style: FilledButton.styleFrom(
              minimumSize: const Size(0, 40),
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.l),
            ),
            child: const Text('Hoy'),
          ),
          const SizedBox(width: AppSpacing.s),
        ],
        _StepButton(
          icon: Icons.chevron_left_rounded,
          tooltip: previousTooltip,
          onPressed: onPrevious,
        ),
        const SizedBox(width: AppSpacing.s),
        _StepButton(
          icon: Icons.chevron_right_rounded,
          tooltip: nextTooltip,
          onPressed: onNext,
        ),
      ],
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      icon: Icon(icon, size: 24),
      style: IconButton.styleFrom(
        minimumSize: const Size(40, 40),
        fixedSize: const Size(40, 40),
        backgroundColor: scheme.surfaceContainerLow,
        side: BorderSide(color: scheme.outlineVariant),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.controlBorder),
      ),
    );
  }
}
