import 'package:go_router/go_router.dart';

import 'pages/client_detail_page.dart';
import 'pages/client_form_page.dart';
import 'pages/clients_page.dart';

abstract final class ClientRoutes {
  static const list = '/clientes';
  static const create = '/clientes/nuevo';
  static String detail(String id) => '/clientes/$id';
  static String edit(String id) => '/clientes/$id/editar';
}

final List<RouteBase> clientsRoutes = [
  GoRoute(
    path: ClientRoutes.list,
    builder: (context, state) => const ClientsPage(),
    routes: [
      GoRoute(
        path: 'nuevo',
        builder: (context, state) => const ClientFormPage(),
      ),
      GoRoute(
        path: ':id',
        builder: (context, state) =>
            ClientDetailPage(clientId: state.pathParameters['id']!),
        routes: [
          GoRoute(
            path: 'editar',
            builder: (context, state) =>
                ClientFormPage(clientId: state.pathParameters['id']),
          ),
        ],
      ),
    ],
  ),
];
