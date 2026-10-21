import 'package:go_router/go_router.dart';

import 'pages/staff_detail_page.dart';
import 'pages/staff_form_page.dart';
import 'pages/staff_list_page.dart';
import 'pages/staff_schedule_page.dart';
import 'pages/staff_time_off_page.dart';

abstract final class StaffRoutes {
  static const list = '/mas/profesionales';
  static const create = '/mas/profesionales/nuevo';
  static String detail(String id) => '/mas/profesionales/$id';
  static String edit(String id) => '/mas/profesionales/$id/editar';
  static String schedule(String id) => '/mas/profesionales/$id/horario';
  static String timeOff(String id) => '/mas/profesionales/$id/ausencias';
}

final List<RouteBase> staffAdminRoutes = [
  GoRoute(
    path: StaffRoutes.list,
    builder: (context, state) => const StaffListPage(),
    routes: [
      GoRoute(
        path: 'nuevo',
        builder: (context, state) => const StaffFormPage(),
      ),
      GoRoute(
        path: ':id',
        builder: (context, state) =>
            StaffDetailPage(staffId: state.pathParameters['id']!),
        routes: [
          GoRoute(
            path: 'editar',
            builder: (context, state) =>
                StaffFormPage(staffId: state.pathParameters['id']),
          ),
          GoRoute(
            path: 'horario',
            builder: (context, state) =>
                StaffSchedulePage(staffId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: 'ausencias',
            builder: (context, state) =>
                StaffTimeOffPage(staffId: state.pathParameters['id']!),
          ),
        ],
      ),
    ],
  ),
];
