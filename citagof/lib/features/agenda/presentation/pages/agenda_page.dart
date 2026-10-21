import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/time/business_clock.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../../staff/presentation/providers/staff_providers.dart';
import '../../domain/entities/appointment.dart';
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
        icon: const Icon(Icons.add),
        label: const Text('Nueva cita'),
      ),
      body: Column(
        children: [
          const _DayNavigator(),
          if (managesBusiness) const _StaffFilter(),
          const Divider(height: 1),
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
                        padding: const EdgeInsets.only(bottom: 96),
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

class _DayNavigator extends ConsumerWidget {
  const _DayNavigator();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final date = ref.watch(selectedDayProvider);
    final controller = ref.read(selectedDayProvider.notifier);
    final isToday = date == ref.watch(businessClockProvider).today();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Día anterior',
            iconSize: 28,
            onPressed: controller.previous,
            icon: const Icon(Icons.chevron_left),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  BusinessClock.longDate(date),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (!isToday)
                  TextButton(
                    onPressed: controller.today,
                    style: TextButton.styleFrom(
                      minimumSize: const Size(0, 36),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                    child: const Text('Hoy'),
                  ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Día siguiente',
            iconSize: 28,
            onPressed: controller.next,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
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
          padding: const EdgeInsets.symmetric(horizontal: 12),
          children: [
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: const Text('Todos'),
                selected: selected == null,
                onSelected: (_) =>
                    ref.read(agendaStaffFilterProvider.notifier).select(null),
              ),
            ),
            for (final member in members)
              Padding(
                padding: const EdgeInsets.only(right: 8),
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

class _AppointmentTile extends ConsumerWidget {
  const _AppointmentTile({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clock = ref.watch(businessClockProvider);
    final start = clock.timeOf(appointment.startAt);
    final end = clock.timeOf(appointment.endAt);
    final clientName = appointment.client?.name ?? 'Sin cliente';
    final serviceName = appointment.service?.name ?? 'Servicio';
    final staffName = appointment.staffMember?.name ?? 'Sin profesional';

    return ListTile(
      minTileHeight: 72,
      leading: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(start, style: Theme.of(context).textTheme.titleSmall),
          Text(
            end,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: Theme.of(context).colorScheme.outline),
          ),
        ],
      ),
      title: Text(clientName),
      subtitle: Text('$serviceName · $staffName'),
      trailing: AppointmentStatusChip(status: appointment.status),
      onTap: () => context.push(AgendaRoutes.detail(appointment.id)),
    );
  }
}

class _EmptyAgenda extends StatelessWidget {
  const _EmptyAgenda();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.2),
        Icon(
          Icons.event_available_outlined,
          size: 56,
          color: Theme.of(context).colorScheme.outline,
        ),
        const SizedBox(height: 12),
        const Text(
          'No hay citas este día. Crea una con "Nueva cita".',
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
