import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/time/business_clock.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/sale.dart';
import '../providers/sale_providers.dart';
import '../sales_routes.dart';
import '../widgets/sale_status_badge.dart';

class SalesPage extends ConsumerStatefulWidget {
  const SalesPage({super.key});

  @override
  ConsumerState<SalesPage> createState() => _SalesPageState();
}

class _SalesPageState extends ConsumerState<SalesPage> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 300) {
        ref.read(salesListProvider.notifier).loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(salesListProvider);
    final session = ref.watch(sessionControllerProvider).value;
    final currency = session?.tenant.currency ?? 'PEN';
    final isStaff = session?.role.managesBusiness == false;

    return Scaffold(
      appBar: AppBar(title: const Text('Ventas')),
      body: Column(
        children: [
          const _RangeNavigator(),
          const _StatusFilterBar(),
          if (isStaff) const _StaffNote(),
          _SummaryStrip(list: list, currency: currency),
          if (list.value?.refreshing ?? false)
            const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: list.when(
              skipLoadingOnReload: true,
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => ErrorView(
                error: error,
                onRetry: () => ref.read(salesListProvider.notifier).refresh(),
              ),
              data: (state) => state.items.isEmpty
                  ? const _EmptyState()
                  : RefreshIndicator(
                      onRefresh: () =>
                          ref.read(salesListProvider.notifier).refresh(),
                      child: ListView.builder(
                        controller: _scroll,
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.only(bottom: 24),
                        itemCount: state.items.length + 1,
                        itemBuilder: (context, index) {
                          if (index == state.items.length) {
                            return _Footer(state: state);
                          }
                          return _SaleTile(
                            sale: state.items[index],
                            currency: currency,
                          );
                        },
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RangeNavigator extends ConsumerWidget {
  const _RangeNavigator();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final range = ref.watch(salesRangeProvider);
    final controller = ref.read(salesRangeProvider.notifier);
    final theme = Theme.of(context);

    final label = switch (range.period) {
      SalesPeriod.day => BusinessClock.longDate(range.anchor),
      SalesPeriod.week => 'Semana del ${BusinessClock.longDate(range.anchor)}',
      SalesPeriod.month => 'Desde ${BusinessClock.longDate(range.anchor)}',
    };

    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                tooltip: 'Anterior',
                onPressed: controller.previous,
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Column(
                  children: [
                    Text(
                      label,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.titleMedium,
                    ),
                    TextButton(
                      onPressed: controller.today,
                      style: TextButton.styleFrom(
                        minimumSize: const Size(0, 36),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                      child: const Text('Hoy'),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Siguiente',
                onPressed: controller.next,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          Wrap(
            spacing: 8,
            children: [
              for (final period in SalesPeriod.values)
                ChoiceChip(
                  label: Text(switch (period) {
                    SalesPeriod.day => 'Día',
                    SalesPeriod.week => 'Esta semana',
                    SalesPeriod.month => 'Este mes',
                  }),
                  selected: range.period == period,
                  onSelected: (_) => controller.setPeriod(period),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusFilterBar extends ConsumerWidget {
  const _StatusFilterBar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(salesStatusFilterProvider);
    final controller = ref.read(salesStatusFilterProvider.notifier);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Row(
        children: [
          for (final filter in SalesStatusFilter.values)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilterChip(
                label: Text(filter.label),
                selected: selected == filter,
                onSelected: (_) => controller.select(filter),
              ),
            ),
        ],
      ),
    );
  }
}

class _StaffNote extends StatelessWidget {
  const _StaffNote();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      child: Row(
        children: [
          Icon(Icons.info_outline, size: 16, color: theme.colorScheme.outline),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              'Ves únicamente las ventas de tu atención.',
              style: theme.textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({required this.list, required this.currency});

  final AsyncValue<SalesListState> list;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = list.value;
    final count = state?.total ?? 0;
    final paid = state == null ? '0.00' : state.paidTotal;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Ventas', style: theme.textTheme.labelMedium),
              Text(
                '$count',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('Cobrado', style: theme.textTheme.labelMedium),
              Text(
                formatMoney(paid, currency),
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: theme.colorScheme.primary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SaleTile extends ConsumerWidget {
  const _SaleTile({required this.sale, required this.currency});

  final Sale sale;
  final String currency;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clock = ref.watch(businessClockProvider);
    final time = sale.soldAt == null ? '' : clock.timeOf(sale.soldAt!);
    final client = sale.client?.name ?? 'Venta de mostrador';

    return ListTile(
      minTileHeight: 64,
      leading: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [Text(time)],
      ),
      title: Text(client),
      subtitle: SaleStatusBadge(status: sale.status),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            formatMoney(sale.total, currency),
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
      onTap: () => context.push(SalesRoutes.detail(sale.id)),
    );
  }
}

class _Footer extends ConsumerWidget {
  const _Footer({required this.state});

  final SalesListState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.loadingMore) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (state.loadMoreFailed) {
      return Padding(
        padding: const EdgeInsets.all(8),
        child: TextButton.icon(
          onPressed: () => ref.read(salesListProvider.notifier).loadMore(),
          icon: const Icon(Icons.refresh),
          label: const Text('No se pudo cargar más. Reintentar'),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.receipt_long_outlined,
                    size: 56,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'No hay ventas en este período.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
