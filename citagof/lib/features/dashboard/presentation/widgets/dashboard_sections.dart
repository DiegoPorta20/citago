import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/router/route_paths.dart';
import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../agenda/domain/entities/appointment.dart';
import '../../../agenda/presentation/agenda_routes.dart';
import '../../../agenda/presentation/providers/upcoming_appointments_provider.dart';
import '../../../agenda/presentation/widgets/appointment_status_chip.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../../conversations/presentation/providers/pending_conversations_provider.dart';
import '../../domain/entities/dashboard.dart';

/// "Citas de hoy": total, how many were attended (with a progress ring) and
/// the cancelled / no-show counts when there are any.
class AppointmentsOverviewCard extends StatelessWidget {
  const AppointmentsOverviewCard({super.key, required this.counters});

  final AppointmentCounters counters;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final progress = counters.isEmpty
        ? 0.0
        : (counters.completed / counters.total).clamp(0.0, 1.0);
    final detail = counters.isEmpty
        ? 'Sin citas todavía'
        : '${counters.completed} atendidas';

    return Semantics(
      container: true,
      label: 'Citas de hoy: ${counters.total}, $detail',
      child: ExcludeSemantics(
        child: AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.event_available_rounded,
                              size: 18,
                              color: scheme.primary,
                            ),
                            const SizedBox(width: AppSpacing.s),
                            Text(
                              'Citas de hoy',
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          '${counters.total}',
                          style: theme.textTheme.displaySmall?.copyWith(
                            fontFeatures: AppText.tabular,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(detail, style: theme.textTheme.bodyMedium),
                      ],
                    ),
                  ),
                  SizedBox(
                    width: 68,
                    height: 68,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox.expand(
                          child: CircularProgressIndicator(
                            value: progress,
                            strokeWidth: 7,
                            strokeCap: StrokeCap.round,
                            backgroundColor: scheme.surfaceContainerHighest,
                          ),
                        ),
                        Text(
                          '${(progress * 100).round()}%',
                          style: theme.textTheme.labelLarge?.copyWith(
                            fontFeatures: AppText.tabular,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (counters.cancelled > 0 || counters.noShow > 0) ...[
                const SizedBox(height: AppSpacing.l),
                Wrap(
                  spacing: AppSpacing.s,
                  runSpacing: AppSpacing.s,
                  children: [
                    if (counters.cancelled > 0)
                      StatusPill(
                        label: counters.cancelled == 1
                            ? '1 cancelada'
                            : '${counters.cancelled} canceladas',
                        tone: StatusTone.danger,
                      ),
                    if (counters.noShow > 0)
                      StatusPill(
                        label: counters.noShow == 1
                            ? '1 no asistió'
                            : '${counters.noShow} no asistieron',
                        tone: StatusTone.neutral,
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class PendingConversationsCard extends ConsumerWidget {
  const PendingConversationsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(pendingConversationsCountProvider);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return pending.when(
      loading: () => const _SectionSkeleton(height: 72),
      error: (error, _) => _InlineError(
        message: failureMessage(error),
        onRetry: () => ref.invalidate(pendingConversationsCountProvider),
      ),
      data: (count) {
        final hasPending = count > 0;
        return AppCard(
          onTap: () => context.go(AppRoutes.conversations),
          color: hasPending
              ? scheme.primaryContainer.withValues(alpha: 0.45)
              : null,
          borderColor: hasPending
              ? scheme.primary.withValues(alpha: 0.35)
              : null,
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: hasPending
                      ? scheme.primary
                      : scheme.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(AppRadius.control),
                ),
                child: Icon(
                  Icons.chat_bubble_outline_rounded,
                  size: 22,
                  color: hasPending
                      ? scheme.onPrimary
                      : scheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      count == 0
                          ? 'Sin conversaciones pendientes'
                          : count == 1
                          ? '1 conversación por responder'
                          : '$count conversaciones por responder',
                      style: theme.textTheme.titleSmall,
                    ),
                    if (hasPending)
                      Text(
                        'Toca para abrir la bandeja',
                        style: theme.textTheme.bodySmall,
                      ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: scheme.onSurfaceVariant),
            ],
          ),
        );
      },
    );
  }
}

class UpcomingAppointmentsSection extends ConsumerWidget {
  const UpcomingAppointmentsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final upcoming = ref.watch(upcomingAppointmentsProvider);
    final clock = ref.watch(businessClockProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Próximas citas',
          actionLabel: 'Ver agenda',
          onAction: () => context.go(AppRoutes.agenda),
        ),
        const SizedBox(height: AppSpacing.s),
        upcoming.when(
          loading: () => const _SectionSkeleton(height: 96),
          error: (error, _) => _InlineError(
            message: failureMessage(error),
            onRetry: () => ref.invalidate(upcomingAppointmentsProvider),
          ),
          data: (appointments) => appointments.isEmpty
              ? const _EmptyUpcoming()
              : Column(
                  children: [
                    for (final appointment in appointments)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.m),
                        child: _UpcomingTile(
                          appointment: appointment,
                          day: clock.dayLabel(
                            clock.dateOf(appointment.startAt),
                          ),
                          time: clock.timeOf(appointment.startAt),
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _EmptyUpcoming extends StatelessWidget {
  const _EmptyUpcoming();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      child: Row(
        children: [
          Icon(
            Icons.event_available_rounded,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Text(
              'No hay citas próximas.',
              style: theme.textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _UpcomingTile extends StatelessWidget {
  const _UpcomingTile({
    required this.appointment,
    required this.day,
    required this.time,
  });

  final Appointment appointment;
  final String day;
  final String time;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return AppCard(
      padding: const EdgeInsets.all(14),
      onTap: () => context.push(AgendaRoutes.detail(appointment.id)),
      child: Row(
        children: [
          Container(
            constraints: const BoxConstraints(minWidth: 64),
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
            decoration: BoxDecoration(
              color: scheme.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(AppRadius.control),
            ),
            child: Column(
              children: [
                Text(day, style: theme.textTheme.labelSmall),
                const SizedBox(height: 2),
                Text(
                  time,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontFeatures: AppText.tabular,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  appointment.client?.name ?? 'Cliente sin nombre',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall,
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    AppointmentStatusChip(status: appointment.status),
                    if (appointment.service != null) ...[
                      const SizedBox(width: AppSpacing.s),
                      Expanded(
                        child: Text(
                          appointment.service!.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
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
