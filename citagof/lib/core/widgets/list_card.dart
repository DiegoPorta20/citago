import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';
import 'app_card.dart';

/// Standard list row inside a card: leading, title, optional subtitle and
/// trailing (a chevron when [onTap] is set and no trailing is given).
class ListCard extends StatelessWidget {
  const ListCard({
    super.key,
    required this.title,
    this.leading,
    this.subtitle,
    this.titleStyle,
    this.trailing,
    this.onTap,
    this.dimmed = false,
    this.padding = const EdgeInsets.all(14),
  });

  final Widget? leading;
  final String title;

  /// Overrides the default title style (e.g. to bold unread conversations).
  final TextStyle? titleStyle;
  final Widget? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool dimmed;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    final effectiveTrailing =
        trailing ??
        (onTap == null
            ? null
            : Icon(
                Icons.chevron_right_rounded,
                color: scheme.onSurfaceVariant,
              ));

    return Opacity(
      opacity: dimmed ? 0.6 : 1,
      child: AppCard(
        padding: padding,
        onTap: onTap,
        child: Row(
          children: [
            if (leading != null) ...[
              leading!,
              const SizedBox(width: AppSpacing.m),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: titleStyle ?? theme.textTheme.titleSmall,
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 3),
                    subtitle!,
                  ],
                ],
              ),
            ),
            if (effectiveTrailing != null) ...[
              const SizedBox(width: AppSpacing.s),
              effectiveTrailing,
            ],
          ],
        ),
      ),
    );
  }
}

/// Muted one-line text for [ListCard.subtitle].
class ListCardSubtitle extends StatelessWidget {
  const ListCardSubtitle(this.text, {super.key, this.icon, this.maxLines = 1});

  final String text;
  final IconData? icon;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final text0 = Text(
      text,
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
      style: theme.textTheme.bodySmall,
    );
    if (icon == null) return text0;
    return Row(
      children: [
        Icon(icon, size: 14, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: 4),
        Expanded(child: text0),
      ],
    );
  }
}
