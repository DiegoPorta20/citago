import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/error_view.dart';
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
        icon: const Icon(Icons.add),
        label: const Text('Nuevo'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Wrap(
              spacing: 8,
              children: [
                for (final option in ServiceFilter.values)
                  ChoiceChip(
                    label: Text(option.label),
                    selected: filter == option,
                    onSelected: (_) =>
                        ref.read(serviceFilterProvider.notifier).set(option),
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
                  ? _EmptyState(filter: filter)
                  : RefreshIndicator(
                      onRefresh: () async =>
                          ref.invalidate(servicesAdminProvider),
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.only(bottom: 96),
                        itemCount: items.length,
                        itemBuilder: (context, index) =>
                            _ServiceTile(service: items[index]),
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

    return ListTile(
      minTileHeight: 64,
      title: Row(
        children: [
          Flexible(child: Text(service.name)),
          if (!service.active) ...[
            const SizedBox(width: 8),
            const _InactiveBadge(),
          ],
        ],
      ),
      subtitle: Text(
        '${service.durationMinutes} min · '
        '${formatMoney(service.price, currency)}',
      ),
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

class _InactiveBadge extends StatelessWidget {
  const _InactiveBadge();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        'Inactivo',
        style: Theme.of(context).textTheme.labelSmall
            ?.copyWith(color: scheme.onSurfaceVariant),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.filter});

  final ServiceFilter filter;

  @override
  Widget build(BuildContext context) {
    final message = switch (filter) {
      ServiceFilter.active => 'No hay servicios activos.',
      ServiceFilter.inactive => 'No hay servicios inactivos.',
      ServiceFilter.all => 'Aún no hay servicios. Crea el primero con "Nuevo".',
    };
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.content_cut,
              size: 56,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
