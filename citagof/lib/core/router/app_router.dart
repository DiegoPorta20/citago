import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/agenda/presentation/agenda_routes.dart';
import '../../features/authentication/presentation/pages/login_page.dart';
import '../../features/authentication/presentation/pages/register_page.dart';
import '../../features/authentication/presentation/pages/switch_tenant_page.dart';
import '../../features/authentication/presentation/pages/splash_page.dart';
import '../../features/authentication/presentation/providers/auth_providers.dart';
import '../../features/business/presentation/business_routes.dart';
import '../../features/catalog/presentation/catalog_routes.dart';
import '../../features/clients/presentation/clients_routes.dart';
import '../../features/conversations/presentation/conversations_routes.dart';
import '../../features/dashboard/presentation/pages/dashboard_page.dart';
import '../../features/profile/presentation/pages/more_page.dart';
import '../../features/sales/presentation/sales_routes.dart';
import '../../features/staff/presentation/staff_routes.dart';
import '../../features/team/presentation/team_routes.dart';
import '../../features/whatsapp/presentation/whatsapp_routes.dart';
import 'app_shell.dart';
import 'route_paths.dart';

export 'route_paths.dart';

String? redirectFor(AsyncValue<Object?> session, String location) {
  final signedIn = session.value != null;
  final starting = session.isLoading || session.hasError;

  if (starting) {
    return location == AppRoutes.splash ? null : AppRoutes.splash;
  }
  if (!signedIn) {
    final isPublic =
        location == AppRoutes.login || location == AppRoutes.register;
    return isPublic ? null : AppRoutes.login;
  }
  if (location == AppRoutes.login ||
      location == AppRoutes.register ||
      location == AppRoutes.splash) {
    return AppRoutes.dashboard;
  }
  return null;
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(sessionControllerProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  final router = GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: refresh,
    redirect: (context, state) =>
        redirectFor(ref.read(sessionControllerProvider), state.matchedLocation),
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashPage(),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: AppRoutes.register,
        builder: (context, state) => const RegisterPage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.dashboard,
                builder: (context, state) => const DashboardPage(),
              ),
            ],
          ),
          StatefulShellBranch(routes: agendaRoutes),
          StatefulShellBranch(routes: conversationsRoutes),
          StatefulShellBranch(routes: clientsRoutes),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.more,
                builder: (context, state) => const MorePage(),
              ),
              ...catalogAdminRoutes,
              ...staffAdminRoutes,
              ...teamRoutes,
              ...businessRoutes,
              ...whatsappRoutes,
              ...salesRoutes,
              GoRoute(
                path: AppRoutes.switchTenant,
                builder: (context, state) => const SwitchTenantPage(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
