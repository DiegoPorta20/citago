import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/widgets/error_view.dart';
import '../providers/auth_providers.dart';

class SplashPage extends ConsumerWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider);
    return Scaffold(
      body: session.hasError && !session.isLoading
          ? ErrorView(
              error: session.error!,
              onRetry: () =>
                  ref.read(sessionControllerProvider.notifier).retry(),
            )
          : const Center(child: CircularProgressIndicator()),
    );
  }
}
