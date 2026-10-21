import 'package:go_router/go_router.dart';

import 'pages/team_member_form_page.dart';
import 'pages/team_page.dart';

abstract final class TeamRoutes {
  static const list = '/mas/equipo';
  static const create = '/mas/equipo/nuevo';
}

final List<RouteBase> teamRoutes = [
  GoRoute(
    path: TeamRoutes.list,
    builder: (context, state) => const TeamPage(),
    routes: [
      GoRoute(
        path: 'nuevo',
        builder: (context, state) => const TeamMemberFormPage(),
      ),
    ],
  ),
];
