import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/time/business_clock.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/appointment.dart';
import '../../domain/entities/appointment_status.dart';
import '../agenda_routes.dart';
import '../providers/agenda_providers.dart';
import '../widgets/appointment_status_chip.dart';

class AppointmentDetailPage extends ConsumerWidget {
  const AppointmentDetailPage({super.key, required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointment = ref.watch(appointmentDetailProvider(appointmentId));

    return Scaffold(
      appBar: AppBar(title: const Text('Cita')),
      body: appointment.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () =>
              ref.invalidate(appointmentDetailProvider(appointmentId)),
        ),
        data: (data) => _Body(appointment: data),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clock = ref.watch(businessClockProvider);
    final session = ref.watch(sessionControllerProvider).value;
    final currency = session?.tenant.currency ?? 'PEN';
    final theme = Theme.of(context);

    final date = clock.dateOf(appointment.startAt);
    final start = clock.timeOf(appointment.startAt);
    final end = clock.timeOf(appointment.endAt);
    final actions = allowedActions(appointment.status);
    final canBill = appointment.status == AppointmentStatus.completed;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Text(
                appointment.client?.name ?? 'Sin cliente',
                style: theme.textTheme.headlineSmall,
              ),
            ),
            AppointmentStatusChip(status: appointment.status),
          ],
        ),
        const SizedBox(height: 16),
        _InfoRow(
          icon: Icons.calendar_today_outlined,
          label: 'Fecha',
          value: BusinessClock.longDate(date),
        ),
        _InfoRow(
          icon: Icons.schedule_outlined,
          label: 'Horario',
          value: '$start – $end',
        ),
        _InfoRow(
          icon: Icons.content_cut_outlined,
          label: 'Servicio',
          value: appointment.service?.name ?? 'Sin servicio',
        ),
        _InfoRow(
          icon: Icons.badge_outlined,
          label: 'Profesional',
          value: appointment.staffMember?.name ?? 'Sin profesional',
        ),
        _InfoRow(
          icon: Icons.payments_outlined,
          label: 'Precio',
          value: formatMoney(appointment.price, currency),
        ),
        if (appointment.notes != null && appointment.notes!.isNotEmpty)
          _InfoRow(
            icon: Icons.notes_outlined,
            label: 'Notas',
            value: appointment.notes!,
          ),
        if (appointment.cancellationReason != null &&
            appointment.cancellationReason!.isNotEmpty)
          _InfoRow(
            icon: Icons.cancel_outlined,
            label: 'Motivo de cancelación',
            value: appointment.cancellationReason!,
          ),
        const SizedBox(height: 16),
        if (canBill)
          FilledButton.icon(
            onPressed: () =>
                context.push(AgendaRoutes.registerSale(appointment.id)),
            icon: const Icon(Icons.point_of_sale),
            label: const Text('Cobrar'),
          ),
        if (appointment.status.isReschedulable)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: OutlinedButton.icon(
              onPressed: () =>
                  context.push(AgendaRoutes.reschedule(appointment.id)),
              icon: const Icon(Icons.event_repeat_outlined),
              label: const Text('Reagendar'),
            ),
          ),
        if (actions.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Acciones', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final action in actions)
                _ActionButton(appointment: appointment, action: action),
            ],
          ),
        ],
        const SizedBox(height: 24),
        if (appointment.history.isNotEmpty) ...[
          Text('Historial', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          for (final change in appointment.history)
            _HistoryTile(change: change, clock: clock),
        ],
      ],
    );
  }
}

class _ActionButton extends ConsumerStatefulWidget {
  const _ActionButton({required this.appointment, required this.action});

  final Appointment appointment;
  final AppointmentAction action;

  @override
  ConsumerState<_ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends ConsumerState<_ActionButton> {
  bool _running = false;

  bool get _destructive =>
      widget.action == AppointmentAction.cancel ||
      widget.action == AppointmentAction.noShow;

  Future<void> _run() async {
    String? reason;
    final needsReason =
        widget.action == AppointmentAction.cancel &&
        cancellationReasonRequired(widget.appointment.status);

    if (widget.action == AppointmentAction.cancel) {
      reason = await _askReason(required: needsReason);
      if (reason == null) return;
    } else if (_destructive) {
      final confirmed = await _confirm();
      if (confirmed != true) return;
    }

    setState(() => _running = true);
    try {
      await ref.read(transitionAppointmentUseCaseProvider)(
        widget.appointment.id,
        widget.action,
        reason: reason == null || reason.isEmpty ? null : reason,
      );
      ref.invalidate(appointmentDetailProvider(widget.appointment.id));
      ref.invalidate(agendaDayProvider);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _running = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(failureMessage(error))));
    }
  }

  Future<bool?> _confirm() {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('¿${widget.action.label}?'),
        content: const Text('Esta acción cambia el estado de la cita.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            onPressed: () => Navigator.pop(context, true),
            child: Text(widget.action.label),
          ),
        ],
      ),
    );
  }

  Future<String?> _askReason({required bool required}) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancelar cita'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 255,
          decoration: InputDecoration(
            labelText: required ? 'Motivo (obligatorio)' : 'Motivo (opcional)',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Volver'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            onPressed: () {
              final text = controller.text.trim();
              if (required && text.isEmpty) return;
              Navigator.pop(context, text);
            },
            child: const Text('Cancelar cita'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final style = _destructive
        ? FilledButton.styleFrom(
            minimumSize: const Size(0, 48),
            backgroundColor: Theme.of(context).colorScheme.errorContainer,
            foregroundColor: Theme.of(context).colorScheme.onErrorContainer,
          )
        : FilledButton.styleFrom(minimumSize: const Size(0, 48));

    return FilledButton(
      style: style,
      onPressed: _running ? null : _run,
      child: _running
          ? const SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Text(widget.action.label),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.change, required this.clock});

  final AppointmentStatusChange change;
  final BusinessClock clock;

  @override
  Widget build(BuildContext context) {
    final date = clock.dateOf(change.changedAt);
    final time = clock.timeOf(change.changedAt);
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.history, size: 20),
      title: Text(change.toStatus.label),
      subtitle: Text(
        '${BusinessClock.longDate(date)} · $time'
        '${change.reason == null || change.reason!.isEmpty ? '' : '\n${change.reason}'}',
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(label),
      subtitle: Text(value),
    );
  }
}
