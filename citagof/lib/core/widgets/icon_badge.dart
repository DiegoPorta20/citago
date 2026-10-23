import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';

/// Rounded square with a tinted icon: the visual anchor of rows and menus.
class IconBadge extends StatelessWidget {
  const IconBadge({super.key, required this.icon, this.size = 40, this.color});

  final IconData icon;
  final double size;

  /// Icon color; defaults to the primary (gold/bronze) accent.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(AppRadius.chip),
      ),
      child: Icon(icon, size: size * 0.5, color: color ?? scheme.primary),
    );
  }
}
