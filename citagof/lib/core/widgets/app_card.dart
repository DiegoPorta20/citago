import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';

/// The one card surface of the app: hairline border, 20px radius, optional
/// tap ripple and optional gradient. Use instead of ad-hoc `Container`s.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.l),
    this.onTap,
    this.color,
    this.borderColor,
    this.gradient,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final Color? borderColor;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final radius = AppRadius.cardBorder;

    return Material(
      type: MaterialType.transparency,
      child: Ink(
        decoration: BoxDecoration(
          color: gradient == null
              ? (color ?? scheme.surfaceContainerLow)
              : null,
          gradient: gradient,
          borderRadius: radius,
          border: Border.all(color: borderColor ?? scheme.outlineVariant),
        ),
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: ClipRRect(
            borderRadius: radius,
            child: Padding(padding: padding, child: child),
          ),
        ),
      ),
    );
  }
}
