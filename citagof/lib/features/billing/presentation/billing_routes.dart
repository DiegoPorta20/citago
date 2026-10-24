import 'package:go_router/go_router.dart';

import 'pages/plans_page.dart';

abstract final class BillingRoutes {
  static const root = '/mas/plan';
}

final List<RouteBase> billingRoutes = [
  GoRoute(
    path: BillingRoutes.root,
    builder: (context, state) => const PlansPage(),
  ),
];
