import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';
import 'error_banner.dart';

/// Pinned footer for forms and editors: an optional error above the primary
/// action, separated from the scrolling content by a hairline.
class BottomActionBar extends StatelessWidget {
  const BottomActionBar({super.key, required this.child, this.error});

  final Widget child;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(top: BorderSide(color: scheme.outlineVariant)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (error != null) ...[
              ErrorBanner(error!),
              const SizedBox(height: AppSpacing.m),
            ],
            child,
          ],
        ),
      ),
    );
  }
}
