import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/time/business_clock.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/period_header.dart';
import '../../../../core/widgets/week_strip.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../../staff/presentation/providers/staff_providers.dart';
import '../../domain/entities/appointment.dart';
import '../../domain/entities/appointment_status.dart';
import '../agenda_routes.dart';
import '../providers/agenda_providers.dart';
import '../widgets/appointment_status_chip.dart';

class AgendaPage extends ConsumerWidget {
  const AgendaPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final managesBusiness =
        ref.watch(sessionControllerProvider).value?.role.managesBusiness ??
        false;
    final day = ref.watch(agendaDayProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Agenda')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(AgendaRoutes.create),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nueva cita'),
      ),
      body: Column(
        children: [
          const _CalendarHeader(),
          if (managesBusiness) const _StaffFilter(),
          _DaySummary(count: day.value?.length),
          Expanded(
            child: day.when(
              skipLoadingOnReload: true,
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => ErrorView(
                error: error,
                onRetry: () => ref.invalidate(agendaDayProvider),
              ),
              data: (appointments) => RefreshIndicator(
                onRefresh: () => ref.refresh(agendaDayProvider.future),
                child: appointments.isEmpty
                    ? const _EmptyAgenda()
                    : ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.only(top: 4, bottom: 104),
                        itemCount: appointments.length,
                        itemBuilder: (context, index) =>
                            _AppointmentTile(appointment: appointments[index]),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Month title with previous/next week, "Hoy" and the Monday–Sunday strip.
class _CalendarHeader extends ConsumerWidget {
  const _CalendarHeader();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final date = ref.watch(selectedDayProvider);
    final controller = ref.read(selectedDayProvider.notifier);
    final today = ref.watch(businessClockProvider).today();

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.xs,
        AppSpacing.page,
        AppSpacing.m,
      ),
      child: Column(
        children: [
          PeriodHeader(
            title: BusinessClock.monthYear(date),
            onTitleTap: () => _pickDate(context, controller, date),
            onToday: date == today ? null : controller.today,
            onPrevious: controller.previousWeek,
            onNext: controller.nextWeek,
            previousTooltip: 'Semana anterior',
            nextTooltip: 'Semana siguiente',
          ),
          const SizedBox(height: AppSpacing.l),
          WeekStrip(
            selected: date,
            today: today,
            onSelected: controller.select,
            onPreviousWeek: controller.previousWeek,
            onNextWeek: controller.nextWeek,
          ),
        ],
      ),
    );
  }

  Future<void> _pickDate(
    BuildContext context,
    SelectedDayController controller,
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

class _StaffFilter extends ConsumerWidget {
  const _StaffFilter();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final staff = ref.watch(activeStaffProvider);
    final selected = ref.watch(agendaStaffFilterProvider);

    return staff.maybeWhen(
      data: (members) => SizedBox(
        height: 48,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.page),
          children: [
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.s),
              child: ChoiceChip(
                label: const Text('Todos'),
                selected: selected == null,
                onSelected: (_) =>
                    ref.read(agendaStaffFilterProvider.notifier).select(null),
              ),
            ),
            for (final member in members)
              Padding(
                padding: const EdgeInsets.only(right: AppSpacing.s),
                child: ChoiceChip(
                  label: Text(member.displayName),
                  selected: selected == member.id,
                  onSelected: (_) => ref
                      .read(agendaStaffFilterProvider.notifier)
                      .select(member.id),
                ),
              ),
          ],
        ),
      ),
      orElse: () => const SizedBox.shrink(),
    );
  }
}

/// "Hoy · Martes 20 de octubre" on the left, the appointment count on the right.
class _DaySummary extends ConsumerWidget {
  const _DaySummary({required this.count});

  final int? count;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final date = ref.watch(selectedDayProvider);
    final clock = ref.watch(businessClockProvider);
    final relative = clock.dayLabel(date);
    final long = BusinessClock.longDateCapitalized(date);
    final label = relative.contains(' ') ? long : '$relative · $long';

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.xs,
        AppSpacing.page,
        AppSpacing.s,
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.titleSmall,
            ),
          ),
          if (count != null)
            Text(
              count == 1 ? '1 cita' : '$count citas',
              style: theme.textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}

/// One row of the day timeline: start/end time on the left, a card with a
/// status-colored edge on the right.
class _AppointmentTile extends ConsumerWidget {
  const _AppointmentTile({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final clock = ref.watch(businessClockProvider);
    final currency =
        ref.watch(sessionControllerProvider).value?.tenant.currency ?? 'PEN';

    final status = appointment.status;
    final start = clock.timeOf(appointment.startAt);
    final end = clock.timeOf(appointment.endAt);
    final minutes = appointment.endAt.difference(appointment.startAt).inMinutes;
    final clientName = appointment.client?.name ?? 'Sin cliente';
    final serviceName = appointment.service?.name ?? 'Servicio';
    final staffName = appointment.staffMember?.name ?? 'Sin profesional';
    final accent = AppStatusColors.of(context)
        .foreground(appointmentTone(status));
    final dimmed =
        status == AppointmentStatus.cancelled ||
        status == AppointmentStatus.noShow;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        0,
        AppSpacing.page,
        AppSpacing.m,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 46,
            child: Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    start,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontFeatures: AppText.tabular,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    end,
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontFeatures: AppText.tabular,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Opacity(
              opacity: dimmed ? 0.6 : 1,
              child: AppCard(
                padding: EdgeInsets.zero,
                onTap: () => context.push(AgendaRoutes.detail(appointment.id)),
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(width: 4, color: accent),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      clientName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: theme.textTheme.titleMedium,
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.s),
                                  Text(
                                    formatMoney(appointment.price, currency),
                                    style: theme.textTheme.labelLarge?.copyWith(
                                      fontFeatures: AppText.tabular,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '$serviceName · $staffName',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: scheme.onSurfaceVariant,
                                ),
                              ),
                              const SizedBox(height: AppSpacing.s),
                              Row(
                                children: [
                                  AppointmentStatusChip(status: status),
                                  const SizedBox(width: AppSpacing.s),
                                  Icon(
                                    Icons.schedule_rounded,
                                    size: 14,
                                    color: scheme.onSurfaceVariant,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '$minutes min',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
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

class _EmptyAgenda extends StatelessWidget {
  const _EmptyAgenda();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: constraints.maxHeight,
            child: const EmptyState(
              icon: Icons.event_available_rounded,
              title: 'No hay citas este día',
              message: 'Crea una con "Nueva cita".',
            ),
          ),
        ],
      ),
    );
  }
}
