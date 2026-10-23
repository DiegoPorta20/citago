import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_tokens.dart';
import '../../../../core/time/business_clock.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/initials_avatar.dart';
import '../../../../core/widgets/period_header.dart';
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
    final period = ref.watch(salesRangeProvider).period;
    final clock = ref.watch(businessClockProvider);

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
                      child: _SalesList(
                        state: state,
                        currency: currency,
                        clock: clock,
                        grouped: period != SalesPeriod.day,
                        controller: _scroll,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Segmented Día / Semana / Mes switch plus the period header, so the
/// selected range and its position in the calendar are always explicit.
class _RangeNavigator extends ConsumerWidget {
  const _RangeNavigator();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final range = ref.watch(salesRangeProvider);
    final controller = ref.read(salesRangeProvider.notifier);
    final clock = ref.watch(businessClockProvider);
    final today = clock.today();
    final isCurrent = range.contains(today);

    final (title, subtitle) = switch (range.period) {
      SalesPeriod.day => _dayTitles(clock, range.anchor),
      SalesPeriod.week => (
        BusinessClock.weekRangeLabel(range.anchor),
        isCurrent ? 'Esta semana' : BusinessClock.monthYear(range.firstDay),
      ),
      SalesPeriod.month => (
        BusinessClock.monthYear(range.anchor),
        isCurrent ? 'Este mes' : null,
      ),
    };
    final (previousTip, nextTip) = switch (range.period) {
      SalesPeriod.day => ('Día anterior', 'Día siguiente'),
      SalesPeriod.week => ('Semana anterior', 'Semana siguiente'),
      SalesPeriod.month => ('Mes anterior', 'Mes siguiente'),
    };

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.xs,
        AppSpacing.page,
        AppSpacing.m,
      ),
      child: Column(
        children: [
          SegmentedButton<SalesPeriod>(
            expandedInsets: EdgeInsets.zero,
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: SalesPeriod.day, label: Text('Día')),
              ButtonSegment(value: SalesPeriod.week, label: Text('Semana')),
              ButtonSegment(value: SalesPeriod.month, label: Text('Mes')),
            ],
            selected: {range.period},
            onSelectionChanged: (selection) =>
                controller.setPeriod(selection.first),
          ),
          const SizedBox(height: AppSpacing.l),
          PeriodHeader(
            title: title,
            subtitle: subtitle,
            onTitleTap: () => _pickDate(context, controller, range.anchor),
            onToday: isCurrent ? null : controller.today,
            onPrevious: controller.previous,
            onNext: controller.next,
            previousTooltip: previousTip,
            nextTooltip: nextTip,
          ),
        ],
      ),
    );
  }

  /// "Hoy" over "Jueves 22 de octubre"; days further away show just the date.
  static (String, String?) _dayTitles(BusinessClock clock, String date) {
    final relative = clock.dayLabel(date);
    final long = BusinessClock.longDateCapitalized(date);
    return relative.contains(' ') ? (long, null) : (relative, long);
  }

  Future<void> _pickDate(
    BuildContext context,
    SalesRangeController controller,
    String current,
  ) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: BusinessClock.toCalendarDate(current),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      controller.select(BusinessClock.fromCalendarDate(picked));
    }
  }
}

class _StatusFilterBar extends ConsumerWidget {
  const _StatusFilterBar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(salesStatusFilterProvider);
    final controller = ref.read(salesStatusFilterProvider.notifier);

    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.page),
        children: [
          for (final filter in SalesStatusFilter.values)
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.s),
              child: ChoiceChip(
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
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.xs,
        AppSpacing.page,
        AppSpacing.xs,
      ),
      child: Row(
        children: [
          Icon(
            Icons.info_outline_rounded,
            size: 16,
            color: theme.colorScheme.onSurfaceVariant,
          ),
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
    final scheme = theme.colorScheme;
    final state = list.value;
    final count = state?.total ?? 0;
    final paid = state == null ? '0.00' : state.paidTotal;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.m,
        AppSpacing.page,
        AppSpacing.m,
      ),
      child: AppCard(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.xl,
          vertical: AppSpacing.l,
        ),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.primaryContainer.withValues(alpha: 0.6),
            scheme.surfaceContainerLow,
          ],
        ),
        child: Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Ventas', style: theme.textTheme.labelMedium),
                const SizedBox(height: 2),
                Text(
                  '$count',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontFeatures: AppText.tabular,
                  ),
                ),
              ],
            ),
            const Spacer(),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('Cobrado', style: theme.textTheme.labelMedium),
                const SizedBox(height: 2),
                Text(
                  formatMoney(paid, currency),
                  style: theme.textTheme.headlineSmall?.copyWith(
                    color: scheme.primary,
                    fontFeatures: AppText.tabular,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Either a day heading (week/month views) or a sale; plus the load-more
/// footer as the last row.
class _SalesList extends StatelessWidget {
  const _SalesList({
    required this.state,
    required this.currency,
    required this.clock,
    required this.grouped,
    required this.controller,
  });

  final SalesListState state;
  final String currency;
  final BusinessClock clock;
  final bool grouped;
  final ScrollController controller;

  @override
  Widget build(BuildContext context) {
    final rows = <Object>[];
    String? currentDay;
    for (final sale in state.items) {
      if (grouped && sale.soldAt != null) {
        final day = clock.dateOf(sale.soldAt!);
        if (day != currentDay) {
          currentDay = day;
          rows.add(day);
        }
      }
      rows.add(sale);
    }

    return ListView.builder(
      controller: controller,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: AppSpacing.xxxl),
      itemCount: rows.length + 1,
      itemBuilder: (context, index) {
        if (index == rows.length) return _Footer(state: state);
        final row = rows[index];
        if (row is String) return _DayHeading(date: row, clock: clock);
        return _SaleTile(sale: row as Sale, currency: currency);
      },
    );
  }
}

class _DayHeading extends StatelessWidget {
  const _DayHeading({required this.date, required this.clock});

  final String date;
  final BusinessClock clock;

  @override
  Widget build(BuildContext context) {
    final relative = clock.dayLabel(date);
    final label = relative.contains(' ')
        ? BusinessClock.longDateCapitalized(date)
        : '$relative · ${BusinessClock.longDateCapitalized(date)}';
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.l,
        AppSpacing.page,
        AppSpacing.s,
      ),
      child: Text(label, style: Theme.of(context).textTheme.titleSmall),
    );
  }
}

class _SaleTile extends ConsumerWidget {
  const _SaleTile({required this.sale, required this.currency});

  final Sale sale;
  final String currency;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final clock = ref.watch(businessClockProvider);
    final time = sale.soldAt == null ? '' : clock.timeOf(sale.soldAt!);
    final clientName = sale.client?.name;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        0,
        AppSpacing.page,
        AppSpacing.m,
      ),
      child: AppCard(
        padding: const EdgeInsets.all(14),
        onTap: () => context.push(SalesRoutes.detail(sale.id)),
        child: Row(
          children: [
            if (clientName != null)
              InitialsAvatar(name: clientName, radius: 20)
            else
              CircleAvatar(
                radius: 20,
                backgroundColor: scheme.surfaceContainerHigh,
                child: Icon(
                  Icons.storefront_outlined,
                  size: 20,
                  color: scheme.onSurfaceVariant,
                ),
              ),
            const SizedBox(width: AppSpacing.m),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    clientName ?? 'Venta de mostrador',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      SaleStatusBadge(status: sale.status),
                      if (time.isNotEmpty) ...[
                        const SizedBox(width: AppSpacing.s),
                        Text(
                          time,
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontFeatures: AppText.tabular,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.m),
            Text(
              formatMoney(sale.total, currency),
              style: theme.textTheme.titleMedium?.copyWith(
                fontFeatures: AppText.tabular,
              ),
            ),
          ],
        ),
      ),
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
        padding: EdgeInsets.all(AppSpacing.l),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (state.loadMoreFailed) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.s),
        child: TextButton.icon(
          onPressed: () => ref.read(salesListProvider.notifier).loadMore(),
          icon: const Icon(Icons.refresh_rounded),
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
          child: const EmptyState(
            icon: Icons.receipt_long_rounded,
            title: 'No hay ventas en este período.',
          ),
        ),
      ),
    );
  }
}
