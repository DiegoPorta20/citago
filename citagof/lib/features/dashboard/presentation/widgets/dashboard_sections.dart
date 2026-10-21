import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/router/route_paths.dart';
import '../../../agenda/domain/entities/appointment.dart';
import '../../../agenda/presentation/agenda_routes.dart';
import '../../../agenda/presentation/providers/upcoming_appointments_provider.dart';
import '../../../agenda/presentation/widgets/appointment_status_chip.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../../conversations/presentation/providers/pending_conversations_provider.dart';

class PendingConversationsCard extends ConsumerWidget {
  const PendingConversationsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(pendingConversationsCountProvider);
    final theme = Theme.of(context);

    return pending.when(
      loading: () => const _SectionSkeleton(height: 72),
      error: (error, _) => _InlineError(
        message: failureMessage(error),
        onRetry: () => ref.invalidate(pendingConversationsCountProvider),
      ),
      data: (count) => Card(
        child: ListTile(
          minTileHeight: 72,
          leading: Badge(
            isLabelVisible: count > 0,
            label: Text('$count'),
            child: const Icon(Icons.chat_outlined),
          ),
          title: Text(
            count == 0
                ? 'Sin conversaciones pendientes'
                : count == 1
                ? '1 conversación por responder'
                : '$count conversaciones por responder',
            style: count > 0
                ? theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  )
                : null,
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.go(AppRoutes.conversations),
        ),
      ),
    );
  }
}

class UpcomingAppointmentsSection extends ConsumerWidget {
  const UpcomingAppointmentsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final upcoming = ref.watch(upcomingAppointmentsProvider);
    final clock = ref.watch(businessClockProvider);
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Próximas citas', style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        upcoming.when(
          loading: () => const _SectionSkeleton(height: 96),
          error: (error, _) => _InlineError(
            message: failureMessage(error),
            onRetry: () => ref.invalidate(upcomingAppointmentsProvider),
          ),
          data: (appointments) => appointments.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Text('No hay citas próximas.'),
                )
              : Column(
                  children: [
                    for (final appointment in appointments)
                      _UpcomingTile(
                        appointment: appointment,
                        when:
                            '${_dayLabel(clock.dateOf(appointment.startAt), clock.today(), clock.addDays(clock.today(), 1))} '
                            '${clock.timeOf(appointment.startAt)}',
                      ),
                  ],
                ),
        ),
      ],
    );
  }

  static String _dayLabel(String date, String today, String tomorrow) {
    if (date == today) return 'Hoy';
    if (date == tomorrow) return 'Mañana';
    return date;
  }
}

class _UpcomingTile extends StatelessWidget {
  const _UpcomingTile({required this.appointment, required this.when});

  final Appointment appointment;
  final String when;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      minTileHeight: 64,
      title: Text(appointment.client?.name ?? 'Cliente sin nombre'),
      subtitle: Text(
        [
          when,
          if (appointment.service != null) appointment.service!.name,
        ].join(' · '),
      ),
      trailing: AppointmentStatusChip(status: appointment.status),
      onTap: () => context.push(AgendaRoutes.detail(appointment.id)),
    );
  }
}

class _SectionSkeleton extends StatelessWidget {
  const _SectionSkeleton({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: height,
    child: const Center(child: CircularProgressIndicator()),
  );
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(child: Text(message)),
      TextButton(onPressed: onRetry, child: const Text('Reintentar')),
    ],
  );
}
