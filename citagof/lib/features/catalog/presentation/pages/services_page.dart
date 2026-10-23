import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/icon_badge.dart';
import '../../../../core/widgets/list_card.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/service.dart';
import '../catalog_routes.dart';
import '../providers/service_providers.dart';

class ServicesPage extends ConsumerWidget {
  const ServicesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final services = ref.watch(servicesAdminProvider);
    final filter = ref.watch(serviceFilterProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Servicios')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(CatalogRoutes.create),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nuevo'),
      ),
      body: Column(
        children: [
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.page,
                vertical: AppSpacing.xs,
              ),
              children: [
                for (final option in ServiceFilter.values)
                  Padding(
                    padding: const EdgeInsets.only(right: AppSpacing.s),
                    child: ChoiceChip(
                      label: Text(option.label),
                      selected: filter == option,
                      onSelected: (_) =>
                          ref.read(serviceFilterProvider.notifier).set(option),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: services.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => ErrorView(
                error: error,
                onRetry: () => ref.invalidate(servicesAdminProvider),
              ),
              data: (items) => items.isEmpty
                  ? _EmptyServices(filter: filter)
                  : RefreshIndicator(
                      onRefresh: () async =>
                          ref.invalidate(servicesAdminProvider),
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.page,
                          AppSpacing.xs,
                          AppSpacing.page,
                          104,
                        ),
                        itemCount: items.length,
                        itemBuilder: (context, index) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.m),
                          child: _ServiceTile(service: items[index]),
                        ),
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ServiceTile extends ConsumerWidget {
  const _ServiceTile({required this.service});

  final Service service;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currency =
        ref.watch(sessionControllerProvider).value?.tenant.currency ?? '';

    return ListCard(
      leading: const IconBadge(icon: Icons.content_cut_rounded),
      title: service.name,
      dimmed: !service.active,
      subtitle: Row(
        children: [
          Flexible(
            child: ListCardSubtitle(
              '${service.durationMinutes} min · '
              '${formatMoney(service.price, currency)}',
            ),
          ),
          if (!service.active) ...[
            const SizedBox(width: AppSpacing.s),
            const StatusPill(
              label: 'Inactivo',
              tone: StatusTone.neutral,
              showDot: false,
            ),
          ],
        ],
      ),
      padding: const EdgeInsets.fromLTRB(14, 10, 4, 10),
      trailing: PopupMenuButton<String>(
        tooltip: 'Acciones',
        onSelected: (value) => _onAction(context, ref, value),
        itemBuilder: (context) => [
          const PopupMenuItem(value: 'edit', child: Text('Editar')),
          if (service.active)
            const PopupMenuItem(value: 'deactivate', child: Text('Desactivar'))
          else
            const PopupMenuItem(value: 'activate', child: Text('Activar')),
        ],
      ),
      onTap: () => context.push(CatalogRoutes.edit(service.id)),
    );
  }

  Future<void> _onAction(
    BuildContext context,
    WidgetRef ref,
    String action,
  ) async {
    if (action == 'edit') {
      context.push(CatalogRoutes.edit(service.id));
      return;
    }

    try {
      if (action == 'activate') {
        await ref.read(activateServiceUseCaseProvider)(service.id);
      } else {
        await ref.read(deactivateServiceUseCaseProvider)(service.id);
      }
    } on Object catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(failureMessage(error))));
      return;
    }

    ref
      ..invalidate(servicesAdminProvider)
      ..invalidate(activeServicesProvider);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          action == 'activate' ? 'Servicio activado.' : 'Servicio desactivado.',
        ),
      ),
    );
  }
}

class _EmptyServices extends StatelessWidget {
  const _EmptyServices({required this.filter});

  final ServiceFilter filter;

  @override
  Widget build(BuildContext context) {
    final message = switch (filter) {
      ServiceFilter.active => 'No hay servicios activos.',
      ServiceFilter.inactive => 'No hay servicios inactivos.',
      ServiceFilter.all => 'Aún no hay servicios. Crea el primero con "Nuevo".',
    };
    return EmptyState(icon: Icons.content_cut_rounded, title: message);
  }
}
