import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/time/business_clock.dart';
import 'core/widgets/app_restart.dart';

void main() {
  initializeBusinessTime();
  runApp(
    const AppRestart(
      child: ProviderScope(retry: _noRetry, child: CitaGoApp()),
    ),
  );
}

class CitaGoApp extends ConsumerWidget {
  const CitaGoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'CitaGo',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      locale: const Locale('es'),
      supportedLocales: const [Locale('es')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      routerConfig: ref.watch(routerProvider),
    );
  }
}

Duration? _noRetry(int retryCount, Object error) => null;
