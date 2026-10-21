import 'package:citagof/core/router/app_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('redirectFor', () {
    test('keeps everyone on the splash while the session is checked', () {
      expect(
        redirectFor(const AsyncLoading(), AppRoutes.dashboard),
        AppRoutes.splash,
      );
      expect(redirectFor(const AsyncLoading(), AppRoutes.splash), isNull);
    });

    test('keeps the splash on startup errors so the user can retry', () {
      final error = AsyncError<Object?>('offline', StackTrace.empty);
      expect(redirectFor(error, AppRoutes.agenda), AppRoutes.splash);
    });

    test('sends signed-out users to login from any protected route', () {
      const session = AsyncData<Object?>(null);
      expect(redirectFor(session, AppRoutes.agenda), AppRoutes.login);
      expect(redirectFor(session, AppRoutes.login), isNull);
    });

    test('sends signed-in users away from login and splash', () {
      const session = AsyncData<Object?>('session');
      expect(redirectFor(session, AppRoutes.login), AppRoutes.dashboard);
      expect(redirectFor(session, AppRoutes.splash), AppRoutes.dashboard);
      expect(redirectFor(session, AppRoutes.clients), isNull);
    });
  });
}
