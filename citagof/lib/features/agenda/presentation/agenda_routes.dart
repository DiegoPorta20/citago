import 'package:go_router/go_router.dart';

import 'pages/agenda_page.dart';
import 'pages/appointment_detail_page.dart';
import 'pages/new_appointment_page.dart';
import 'pages/reschedule_appointment_page.dart';
import '../../sales/presentation/pages/register_sale_page.dart';

abstract final class AgendaRoutes {
  static const list = '/agenda';
  static const create = '/agenda/nueva';
  static String detail(String id) => '/agenda/$id';
  static String reschedule(String id) => '/agenda/$id/reagendar';
  static String registerSale(String id) => '/agenda/$id/cobrar';
}

final List<RouteBase> agendaRoutes = [
  GoRoute(
    path: AgendaRoutes.list,
    builder: (context, state) => const AgendaPage(),
    routes: [
      GoRoute(
        path: 'nueva',
        builder: (context, state) => const NewAppointmentPage(),
      ),
      GoRoute(
        path: ':id',
        builder: (context, state) =>
            AppointmentDetailPage(appointmentId: state.pathParameters['id']!),
        routes: [
          GoRoute(
            path: 'reagendar',
            builder: (context, state) => RescheduleAppointmentPage(
              appointmentId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: 'cobrar',
            builder: (context, state) =>
                RegisterSalePage(appointmentId: state.pathParameters['id']!),
          ),
        ],
      ),
    ],
  ),
];
