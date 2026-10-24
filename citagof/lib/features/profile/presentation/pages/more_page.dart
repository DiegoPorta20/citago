import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_paths.dart';
import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/initials_avatar.dart';
import '../../../../core/widgets/section_header.dart';
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
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          AppSpacing.s,
          AppSpacing.page,
          AppSpacing.xxxl,
        ),
        children: [
          if (session != null) ...[
            _ProfileCard(session: session),
            const SizedBox(height: AppSpacing.xxl),
          ],
          const SectionHeader(title: 'Operación'),
          const SizedBox(height: AppSpacing.s),
          const _MenuGroup(
            items: [
              _MenuItem(
                icon: Icons.receipt_long_rounded,
                title: 'Ventas',
                path: AppRoutes.sales,
              ),
            ],
          ),
          if (manages) ...[
            const SizedBox(height: AppSpacing.xxl),
            const SectionHeader(title: 'Administración'),
            const SizedBox(height: AppSpacing.s),
            const _MenuGroup(
              items: [
                _MenuItem(
                  icon: Icons.content_cut_rounded,
                  title: 'Servicios',
                  path: AppRoutes.services,
                ),
                _MenuItem(
                  icon: Icons.badge_outlined,
                  title: 'Profesionales',
                  path: AppRoutes.staff,
                ),
                _MenuItem(
                  icon: Icons.groups_outlined,
                  title: 'Equipo y accesos',
                  path: AppRoutes.team,
                ),
                _MenuItem(
                  icon: Icons.storefront_outlined,
                  title: 'Mi negocio',
                  path: AppRoutes.business,
                ),
                _MenuItem(
                  icon: Icons.chat_outlined,
                  title: 'WhatsApp',
                  path: AppRoutes.whatsapp,
                ),
                _MenuItem(
                  icon: Icons.workspace_premium_outlined,
                  title: 'Plan y suscripción',
                  path: AppRoutes.billing,
                ),
              ],
            ),
          ],
          if (hasSeveralBusinesses) ...[
            const SizedBox(height: AppSpacing.xxl),
            const SectionHeader(title: 'Cuenta'),
            const SizedBox(height: AppSpacing.s),
            const _MenuGroup(
              items: [
                _MenuItem(
                  icon: Icons.swap_horiz_rounded,
                  title: 'Cambiar de negocio',
                  path: AppRoutes.switchTenant,
                ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.xxl),
          FilledButton.tonalIcon(
            style: FilledButton.styleFrom(
              backgroundColor: AppStatusColors.of(context)
                  .background(StatusTone.danger),
              foregroundColor: AppStatusColors.of(context)
                  .foreground(StatusTone.danger),
            ),
            onPressed: () =>
                ref.read(sessionControllerProvider.notifier).signOut(),
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
  }
}

String _roleLabel(UserRole role) => switch (role) {
  UserRole.owner => 'Propietario',
  UserRole.admin => 'Administrador',
  UserRole.staff => 'Profesional',
};

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.session});

  final AuthSession session;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.xl),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          scheme.primaryContainer.withValues(alpha: 0.7),
          scheme.surfaceContainerLow,
        ],
      ),
      child: Row(
        children: [
          InitialsAvatar(name: session.user.name, radius: 28),
          const SizedBox(width: AppSpacing.l),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.user.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleLarge,
                ),
                Text(
                  session.user.email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: AppSpacing.s),
                Text(
                  '${session.tenant.name} · ${_roleLabel(session.role)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: scheme.primary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuItem {
  const _MenuItem({
    required this.icon,
    required this.title,
    required this.path,
  });

  final IconData icon;
  final String title;
  final String path;
}

/// Rows inside one card, separated by inset dividers.
class _MenuGroup extends StatelessWidget {
  const _MenuGroup({required this.items});

  final List<_MenuItem> items;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0)
              const Padding(
                padding: EdgeInsets.only(left: 72),
                child: Divider(),
              ),
            InkWell(
              onTap: () => context.push(items[i].path),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.l,
                  vertical: 14,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: scheme.surfaceContainerHigh,
                        borderRadius: BorderRadius.circular(AppRadius.chip),
                      ),
                      child: Icon(
                        items[i].icon,
                        size: 20,
                        color: scheme.primary,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.l),
                    Expanded(
                      child: Text(
                        items[i].title,
                        style: theme.textTheme.titleSmall,
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: scheme.onSurfaceVariant,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
