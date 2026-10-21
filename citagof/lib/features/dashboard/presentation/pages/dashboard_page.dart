import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../agenda/presentation/providers/upcoming_appointments_provider.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../../conversations/presentation/providers/pending_conversations_provider.dart';
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
      appBar: AppBar(title: Text(session?.tenant.name ?? 'Inicio')),
      body: managesBusiness
          ? const _BusinessDashboardBody()
          : const _OwnDashboardBody(),
    );
  }
}

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
    final theme = Theme.of(context);
    final appointments = data.appointments;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        Text('Hoy · ${data.from}', style: theme.textTheme.labelLarge),
        const SizedBox(height: 12),
        const PendingConversationsCard(),
        const SizedBox(height: 12),
        _MetricCard(
          label: 'Ingresos cobrados',
          value: formatMoney(data.revenue.paid, data.currency),
          detail: data.revenue.pendingCount > 0
              ? '${formatMoney(data.revenue.pending, data.currency)} por cobrar'
              : '${data.revenue.paidCount} ventas',
          icon: Icons.payments_outlined,
          emphasize: true,
        ),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _MetricCard(
                label: 'Citas de hoy',
                value: '${appointments.total}',
                detail: appointments.isEmpty
                    ? 'Sin citas todavía'
                    : '${appointments.completed} atendidas',
                icon: Icons.event_available_outlined,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _MetricCard(
                label: 'Clientes nuevos',
                value: '${data.newClients}',
                detail: appointments.noShow > 0
                    ? '${appointments.noShow} no asistieron'
                    : null,
                icon: Icons.person_add_alt_outlined,
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        const UpcomingAppointmentsSection(),
        if (data.topServices.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text('Lo más vendido', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          for (final service in data.topServices.take(3))
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(service.description),
              subtitle: Text('${service.quantity} vendidos'),
              trailing: Text(formatMoney(service.total, data.currency)),
            ),
        ],
        if (data.staff.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text('Por profesional', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          for (final member in data.staff)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(member.name),
              subtitle: Text('${member.completedAppointments} atenciones'),
              trailing: Text(formatMoney(member.revenue, data.currency)),
            ),
        ],
      ],
    );
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
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Tus atenciones · ${data.from}',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: 12),
            _MetricCard(
              label: 'Citas de hoy',
              value: '${data.appointments.total}',
              detail: data.appointments.isEmpty
                  ? 'Sin citas todavía'
                  : '${data.appointments.completed} atendidas',
              icon: Icons.event_available_outlined,
              emphasize: true,
            ),
            const SizedBox(height: 12),
            const PendingConversationsCard(),
            const SizedBox(height: 24),
            const UpcomingAppointmentsSection(),
          ],
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    this.detail,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final String? detail;
  final IconData icon;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      container: true,
      label: '$label: $value${detail == null ? '' : ', $detail'}',
      child: ExcludeSemantics(
        child: Card(
          color: emphasize ? theme.colorScheme.primaryContainer : null,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(icon, size: 20),
                    const SizedBox(width: 8),
                    Flexible(child: Text(label)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  value,
                  style:
                      (emphasize
                              ? theme.textTheme.headlineLarge
                              : theme.textTheme.headlineMedium)
                          ?.copyWith(fontWeight: FontWeight.bold),
                ),
                if (detail != null) ...[
                  const SizedBox(height: 4),
                  Text(detail!, style: theme.textTheme.bodySmall),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
