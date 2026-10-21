import 'package:go_router/go_router.dart';

import 'pages/whatsapp_channel_page.dart';
import 'pages/whatsapp_connect_page.dart';

abstract final class WhatsAppRoutes {
  static const root = '/mas/whatsapp';
  static const connect = '/mas/whatsapp/conectar';
}

final List<RouteBase> whatsappRoutes = [
  GoRoute(
    path: WhatsAppRoutes.root,
    builder: (context, state) => const WhatsAppChannelPage(),
    routes: [
      GoRoute(
        path: 'conectar',
        builder: (context, state) => const WhatsAppConnectPage(),
      ),
    ],
  ),
];
