import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';
import 'app_card.dart';
import 'icon_badge.dart';

/// Label over value with an [IconBadge] on the left.
class InfoRow extends StatelessWidget {
  const InfoRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.emphasize = false,
    this.note,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool emphasize;

  /// Small muted line under the value (e.g. "No se puede cambiar").
  final String? note;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.m),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconBadge(icon: icon),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: theme.textTheme.bodySmall),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: emphasize ? FontWeight.w700 : FontWeight.w500,
                    fontFeatures: emphasize ? AppText.tabular : null,
                  ),
                ),
                if (note != null) ...[
                  const SizedBox(height: 2),
                  Text(note!, style: theme.textTheme.bodySmall),
                ],
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// A card that stacks [children] (usually [InfoRow]s) with inset dividers.
class InfoCard extends StatelessWidget {
  const InfoCard({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.l,
        vertical: AppSpacing.xs,
      ),
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0)
              const Padding(
                padding: EdgeInsets.only(left: 40 + AppSpacing.m),
                child: Divider(),
              ),
            children[i],
          ],
        ],
      ),
    );
  }
}
