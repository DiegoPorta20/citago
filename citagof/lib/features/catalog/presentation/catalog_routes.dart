import 'package:go_router/go_router.dart';

import 'pages/service_form_page.dart';
import 'pages/services_page.dart';

abstract final class CatalogRoutes {
  static const list = '/mas/servicios';
  static const create = '/mas/servicios/nuevo';
  static String edit(String id) => '/mas/servicios/$id/editar';
}

final List<RouteBase> catalogAdminRoutes = [
  GoRoute(
    path: CatalogRoutes.list,
    builder: (context, state) => const ServicesPage(),
    routes: [
      GoRoute(
        path: 'nuevo',
        builder: (context, state) => const ServiceFormPage(),
      ),
      GoRoute(
        path: ':id/editar',
        builder: (context, state) =>
            ServiceFormPage(serviceId: state.pathParameters['id']),
      ),
    ],
  ),
];
