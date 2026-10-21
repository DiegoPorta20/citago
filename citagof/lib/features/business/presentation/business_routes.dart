import 'package:go_router/go_router.dart';

import 'pages/business_hours_page.dart';
import 'pages/business_page.dart';
import 'pages/business_settings_page.dart';

abstract final class BusinessRoutes {
  static const root = '/mas/negocio';
  static const editSettings = '/mas/negocio/editar';
  static const editHours = '/mas/negocio/horario';
}

final List<RouteBase> businessRoutes = [
  GoRoute(
    path: BusinessRoutes.root,
    builder: (context, state) => const BusinessPage(),
    routes: [
      GoRoute(
        path: 'editar',
        builder: (context, state) => const BusinessSettingsPage(),
      ),
      GoRoute(
        path: 'horario',
        builder: (context, state) => const BusinessHoursPage(),
      ),
    ],
  ),
];
