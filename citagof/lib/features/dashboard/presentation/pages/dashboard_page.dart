import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_tokens.dart';
import '../../../../core/time/business_clock.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/initials_avatar.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../../core/theme/app_status_colors.dart';
import '../../../agenda/presentation/providers/upcoming_appointments_provider.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../../conversations/presentation/providers/pending_conversations_provider.dart';
import '../../../sales/domain/entities/money.dart';
import '../../domain/entities/dashboard.dart';
import '../providers/dashboard_providers.dart';
import '../widgets/dashboard_sections.dart';

void _refreshSections(WidgetRef ref) {
  ref.invalidate(pendingConversationsCountProvider);
  ref.invalidate(upcomingAppointmentsProvider);
}

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider).value;
    final managesBusiness = session?.role.managesBusiness ?? false;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: managesBusiness
            ? const _BusinessDashboardBody()
            : const _OwnDashboardBody(),
      ),
    );
  }
}

/// Business name, a time-of-day greeting and today's date.
class _DashboardHeader extends ConsumerWidget {
  const _DashboardHeader();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final session = ref.watch(sessionControllerProvider).value;
    final clock = ref.watch(businessClockProvider);

    final hour = clock.hourNow();
    final greeting = hour < 12
        ? 'Buenos días'
        : hour < 19
        ? 'Buenas tardes'
        : 'Buenas noches';
    final fullName = session?.user.name ?? '';
    final firstName = fullName.trim().split(RegExp(r'\s+')).first;

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                session?.tenant.name ?? 'Inicio',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                firstName.isEmpty ? greeting : '$greeting, $firstName',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.headlineMedium,
              ),
              const SizedBox(height: 2),
              Text(
                BusinessClock.longDateCapitalized(clock.today()),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        if (fullName.isNotEmpty) InitialsAvatar(name: fullName, radius: 24),
      ],
    );
  }
}

const _pagePadding = EdgeInsets.fromLTRB(
  AppSpacing.page,
  AppSpacing.l,
  AppSpacing.page,
  AppSpacing.xxxl,
);

class _BusinessDashboardBody extends ConsumerWidget {
  const _BusinessDashboardBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(businessDashboardProvider);
    return dashboard.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => ErrorView(
        error: error,
        onRetry: () => ref.invalidate(businessDashboardProvider),
      ),
      data: (data) => RefreshIndicator(
        onRefresh: () {
          _refreshSections(ref);
          return ref.refresh(businessDashboardProvider.future);
        },
        child: _BusinessContent(data: data),
      ),
    );
  }
}

class _BusinessContent extends StatelessWidget {
  const _BusinessContent({required this.data});

  final BusinessDashboard data;

  @override
  Widget build(BuildContext context) {
    final revenue = data.revenue;
    final average = _averageTicket(revenue);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: _pagePadding,
      children: [
        const _DashboardHeader(),
        const SizedBox(height: AppSpacing.xxl),
        _RevenueHero(
          revenue: revenue,
          currency: data.currency,
          newClients: data.newClients,
          averageTicket: average,
        ),
        const SizedBox(height: AppSpacing.m),
        AppointmentsOverviewCard(counters: data.appointments),
        const SizedBox(height: AppSpacing.m),
        const PendingConversationsCard(),
        const SizedBox(height: AppSpacing.xxl),
        const UpcomingAppointmentsSection(),
        if (data.topServices.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xxl),
          _TopServices(services: data.topServices, currency: data.currency),
        ],
        if (data.staff.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xxl),
          _StaffPerformanceList(staff: data.staff, currency: data.currency),
        ],
      ],
    );
  }

  /// Average paid ticket, `null` when it would just repeat the revenue.
  static String? _averageTicket(Revenue revenue) {
    if (revenue.paidCount < 2) return null;
    final total = Money.tryParse(revenue.paid);
    if (total == null) return null;
    return Money(total.cents ~/ revenue.paidCount).toDecimalString();
  }
}

class _OwnDashboardBody extends ConsumerWidget {
  const _OwnDashboardBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(ownDashboardProvider);
    return dashboard.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => ErrorView(
        error: error,
        onRetry: () => ref.invalidate(ownDashboardProvider),
      ),
      data: (data) => RefreshIndicator(
        onRefresh: () {
          _refreshSections(ref);
          return ref.refresh(ownDashboardProvider.future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: _pagePadding,
          children: [
            const _DashboardHeader(),
            const SizedBox(height: AppSpacing.xxl),
            AppointmentsOverviewCard(counters: data.appointments),
            const SizedBox(height: AppSpacing.m),
            const PendingConversationsCard(),
            const SizedBox(height: AppSpacing.xxl),
            const UpcomingAppointmentsSection(),
          ],
        ),
      ),
    );
  }
}

/// The headline number of the day, with the secondary KPIs underneath.
class _RevenueHero extends StatelessWidget {
  const _RevenueHero({
    required this.revenue,
    required this.currency,
    required this.newClients,
    required this.averageTicket,
  });

  final Revenue revenue;
  final String currency;
  final int newClients;

  /// Decimal string, or `null` when there are too few sales to average.
  final String? averageTicket;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final value = formatMoney(revenue.paid, currency);
    final detail = revenue.pendingCount > 0
        ? '${formatMoney(revenue.pending, currency)} por cobrar'
        : revenue.paidCount > 0
        ? '${revenue.paidCount} ventas'
        : 'Sin ventas todavía';
    final tone = revenue.pendingCount > 0
        ? StatusTone.warning
        : revenue.paidCount > 0
        ? StatusTone.success
        : StatusTone.neutral;

    return Semantics(
      container: true,
      label: 'Ingresos cobrados: $value, $detail',
      child: ExcludeSemantics(
        child: AppCard(
          padding: const EdgeInsets.all(AppSpacing.xl),
          borderColor: scheme.primary.withValues(alpha: 0.3),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              scheme.primaryContainer,
              scheme.primaryContainer.withValues(alpha: 0.25),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.payments_rounded,
                    size: 18,
                    color: scheme.onPrimaryContainer,
                  ),
                  const SizedBox(width: AppSpacing.s),
                  Text(
                    'Ingresos cobrados',
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: scheme.onPrimaryContainer,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.m),
              Text(
                value,
                style: theme.textTheme.displayMedium?.copyWith(
                  color: scheme.onPrimaryContainer,
                  fontFeatures: AppText.tabular,
                ),
              ),
              const SizedBox(height: AppSpacing.m),
              StatusPill(label: detail, tone: tone),
              const SizedBox(height: AppSpacing.l),
              Divider(color: scheme.onPrimaryContainer.withValues(alpha: 0.15)),
              const SizedBox(height: AppSpacing.l),
              Row(
                children: [
                  Expanded(
                    child: _HeroStat(
                      label: 'Clientes nuevos',
                      value: '$newClients',
                    ),
                  ),
                  Expanded(
                    child: _HeroStat(
                      label: 'Ticket promedio',
                      value: averageTicket == null
                          ? '—'
                          : formatMoney(averageTicket!, currency),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = theme.colorScheme.onPrimaryContainer;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: color.withValues(alpha: 0.75),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: theme.textTheme.titleLarge?.copyWith(
            color: color,
            fontFeatures: AppText.tabular,
          ),
        ),
      ],
    );
  }
}

class _TopServices extends StatelessWidget {
  const _TopServices({required this.services, required this.currency});

  final List<ServiceSales> services;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final shown = services.take(3).toList();
    final maxQuantity = shown.fold<int>(
      1,
      (max, service) => service.quantity > max ? service.quantity : max,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Lo más vendido'),
        const SizedBox(height: AppSpacing.s),
        AppCard(
          child: Column(
            children: [
              for (var i = 0; i < shown.length; i++) ...[
                if (i > 0) const SizedBox(height: AppSpacing.l),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            shown[i].description,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall,
                          ),
                          const SizedBox(height: AppSpacing.s),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(999),
                            child: LinearProgressIndicator(
                              value: shown[i].quantity / maxQuantity,
                              minHeight: 6,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.l),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          formatMoney(shown[i].total, currency),
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontFeatures: AppText.tabular,
                          ),
                        ),
                        Text(
                          '${shown[i].quantity} vendidos',
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _StaffPerformanceList extends StatelessWidget {
  const _StaffPerformanceList({required this.staff, required this.currency});

  final List<StaffPerformance> staff;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Por profesional'),
        const SizedBox(height: AppSpacing.s),
        AppCard(
          child: Column(
            children: [
              for (var i = 0; i < staff.length; i++) ...[
                if (i > 0)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpacing.m),
                    child: Divider(),
                  ),
                Row(
                  children: [
                    InitialsAvatar(name: staff[i].name, radius: 20),
                    const SizedBox(width: AppSpacing.m),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            staff[i].name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall,
                          ),
                          Text(
                            '${staff[i].completedAppointments} atenciones',
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    Text(
                      formatMoney(staff[i].revenue, currency),
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontFeatures: AppText.tabular,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
