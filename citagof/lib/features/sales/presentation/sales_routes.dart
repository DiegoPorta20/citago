import 'package:go_router/go_router.dart';

import 'pages/sale_detail_page.dart';
import 'pages/sales_page.dart';

abstract final class SalesRoutes {
  static const list = '/mas/ventas';
  static String detail(String id) => '/mas/ventas/$id';
}

final List<RouteBase> salesRoutes = [
  GoRoute(
    path: SalesRoutes.list,
    builder: (context, state) => const SalesPage(),
    routes: [
      GoRoute(
        path: ':id',
        builder: (context, state) =>
            SaleDetailPage(saleId: state.pathParameters['id']!),
      ),
    ],
  ),
];
