import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_paths.dart';
import '../../../authentication/domain/entities/auth_session.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';

class MorePage extends ConsumerWidget {
  const MorePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider).value;
    final manages = session?.role.managesBusiness ?? false;
    final hasSeveralBusinesses =
        (ref.watch(myTenantsProvider).value?.length ?? 0) > 1;

    return Scaffold(
      appBar: AppBar(title: const Text('Más')),
      body: ListView(
        children: [
          if (session != null)
            ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person)),
              title: Text(session.user.name),
              subtitle: Text(
                '${session.user.email}\n${session.tenant.name} · ${_roleLabel(session.role)}',
              ),
              isThreeLine: true,
            ),
          const Divider(),
          const _MenuTile(
            icon: Icons.receipt_long_outlined,
            title: 'Ventas',
            path: AppRoutes.sales,
          ),
          if (manages) ...const [
            _MenuTile(
              icon: Icons.content_cut,
              title: 'Servicios',
              path: AppRoutes.services,
            ),
            _MenuTile(
              icon: Icons.badge_outlined,
              title: 'Profesionales',
              path: AppRoutes.staff,
            ),
            _MenuTile(
              icon: Icons.groups_outlined,
              title: 'Equipo y accesos',
              path: AppRoutes.team,
            ),
            _MenuTile(
              icon: Icons.storefront_outlined,
              title: 'Mi negocio',
              path: AppRoutes.business,
            ),
            _MenuTile(
              icon: Icons.chat_outlined,
              title: 'WhatsApp',
              path: AppRoutes.whatsapp,
            ),
          ],
          const Divider(),
          if (hasSeveralBusinesses)
            const _MenuTile(
              icon: Icons.swap_horiz,
              title: 'Cambiar de negocio',
              path: AppRoutes.switchTenant,
            ),
          ListTile(
            minTileHeight: 56,
            leading: const Icon(Icons.logout),
            title: const Text('Cerrar sesión'),
            onTap: () => ref.read(sessionControllerProvider.notifier).signOut(),
          ),
        ],
      ),
    );
  }

  String _roleLabel(UserRole role) => switch (role) {
    UserRole.owner => 'Propietario',
    UserRole.admin => 'Administrador',
    UserRole.staff => 'Profesional',
  };
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.title,
    required this.path,
  });

  final IconData icon;
  final String title;
  final String path;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      minTileHeight: 56,
      leading: Icon(icon),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => context.push(path),
    );
  }
}
