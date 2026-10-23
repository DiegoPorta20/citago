import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/time/business_clock.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/initials_avatar.dart';
import '../../../../core/widgets/section_header.dart';
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

/// The next step of the normal flow, shown as the single prominent action.
AppointmentAction? _primaryActionFor(AppointmentStatus status) =>
    switch (status) {
      AppointmentStatus.pending => AppointmentAction.confirm,
      AppointmentStatus.confirmed => AppointmentAction.arrive,
      AppointmentStatus.arrived => AppointmentAction.start,
      AppointmentStatus.inProgress => AppointmentAction.complete,
      AppointmentStatus.noShow => AppointmentAction.complete,
      _ => null,
    };

bool _isDestructive(AppointmentAction action) =>
    action == AppointmentAction.cancel || action == AppointmentAction.noShow;

class _Body extends ConsumerWidget {
  const _Body({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clock = ref.watch(businessClockProvider);
    final session = ref.watch(sessionControllerProvider).value;
    final currency = session?.tenant.currency ?? 'PEN';

    final status = appointment.status;
    final actions = allowedActions(status);
    final canBill = status == AppointmentStatus.completed;
    final primary = canBill ? null : _primaryActionFor(status);
    final secondary = [
      for (final action in actions)
        if (action != primary && !_isDestructive(action)) action,
    ];
    final destructive = [
      for (final action in actions)
        if (_isDestructive(action)) action,
    ];
    final hasNotes = appointment.notes != null && appointment.notes!.isNotEmpty;
    final hasReason =
        appointment.cancellationReason != null &&
        appointment.cancellationReason!.isNotEmpty;
    final hasActions =
        canBill ||
        primary != null ||
        secondary.isNotEmpty ||
        destructive.isNotEmpty ||
        status.isReschedulable;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.s,
        AppSpacing.page,
        AppSpacing.xxxl,
      ),
      children: [
        _HeaderCard(appointment: appointment, clock: clock),
        if (hasActions) ...[
          const SizedBox(height: AppSpacing.xl),
          const SectionHeader(title: 'Acciones'),
          const SizedBox(height: AppSpacing.m),
          if (canBill)
            FilledButton.icon(
              onPressed: () =>
                  context.push(AgendaRoutes.registerSale(appointment.id)),
              icon: const Icon(Icons.point_of_sale_rounded),
              label: const Text('Cobrar'),
            ),
          if (primary != null)
            _ActionButton(
              appointment: appointment,
              action: primary,
              kind: _ActionKind.primary,
            ),
          if (secondary.isNotEmpty || status.isReschedulable) ...[
            const SizedBox(height: AppSpacing.m),
            _ButtonGrid(
              children: [
                for (final action in secondary)
                  _ActionButton(
                    appointment: appointment,
                    action: action,
                    kind: _ActionKind.secondary,
                  ),
                if (status.isReschedulable)
                  FilledButton.tonalIcon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 48),
                    ),
                    onPressed: () =>
                        context.push(AgendaRoutes.reschedule(appointment.id)),
                    icon: const Icon(Icons.event_repeat_rounded, size: 20),
                    label: const Text('Reagendar'),
                  ),
              ],
            ),
          ],
          if (destructive.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            _ButtonGrid(
              children: [
                for (final action in destructive)
                  _ActionButton(
                    appointment: appointment,
                    action: action,
                    kind: _ActionKind.destructive,
                  ),
              ],
            ),
          ],
        ],
        const SizedBox(height: AppSpacing.xxl),
        const SectionHeader(title: 'Detalle'),
        const SizedBox(height: AppSpacing.m),
        AppCard(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.l,
            vertical: AppSpacing.xs,
          ),
          child: Column(
            children: [
              _InfoRow(
                icon: Icons.content_cut_rounded,
                label: 'Servicio',
                value: appointment.service?.name ?? 'Sin servicio',
              ),
              const _RowDivider(),
              _InfoRow(
                icon: Icons.badge_outlined,
                label: 'Profesional',
                value: appointment.staffMember?.name ?? 'Sin profesional',
              ),
              const _RowDivider(),
              _InfoRow(
                icon: Icons.payments_outlined,
                label: 'Precio',
                value: formatMoney(appointment.price, currency),
                emphasize: true,
              ),
              if (hasNotes) ...[
                const _RowDivider(),
                _InfoRow(
                  icon: Icons.notes_rounded,
                  label: 'Notas',
                  value: appointment.notes!,
                ),
              ],
              if (hasReason) ...[
                const _RowDivider(),
                _InfoRow(
                  icon: Icons.cancel_outlined,
                  label: 'Motivo de cancelación',
                  value: appointment.cancellationReason!,
                ),
              ],
            ],
          ),
        ),
        if (appointment.history.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xxl),
          const SectionHeader(title: 'Historial'),
          const SizedBox(height: AppSpacing.m),
          AppCard(
            child: Column(
              children: [
                for (var i = 0; i < appointment.history.length; i++)
                  _HistoryTile(
                    change: appointment.history[i],
                    clock: clock,
                    isLast: i == appointment.history.length - 1,
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// Client, status and — front and center — when the appointment happens.
class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.appointment, required this.clock});

  final Appointment appointment;
  final BusinessClock clock;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    final date = clock.dateOf(appointment.startAt);
    final start = clock.timeOf(appointment.startAt);
    final end = clock.timeOf(appointment.endAt);
    final minutes = appointment.endAt.difference(appointment.startAt).inMinutes;
    final relative = clock.dayLabel(date);
    final long = BusinessClock.longDateCapitalized(date);
    final dateLabel = relative.contains(' ') ? long : '$relative · $long';
    final clientName = appointment.client?.name ?? 'Sin cliente';

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.xl),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          scheme.primaryContainer.withValues(alpha: 0.7),
          scheme.surfaceContainerLow,
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              InitialsAvatar(name: clientName, radius: 24),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Text(
                  clientName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.headlineSmall,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.m),
          AppointmentStatusChip(status: appointment.status),
          const SizedBox(height: AppSpacing.xl),
          Text(
            '$start – $end',
            style: theme.textTheme.headlineMedium?.copyWith(
              fontFeatures: AppText.tabular,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '$dateLabel · $minutes min',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.m),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: scheme.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(AppRadius.chip),
            ),
            child: Icon(icon, size: 20, color: scheme.primary),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: theme.textTheme.bodySmall),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: emphasize ? FontWeight.w700 : FontWeight.w500,
                    fontFeatures: emphasize ? AppText.tabular : null,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RowDivider extends StatelessWidget {
  const _RowDivider();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.only(left: 40 + AppSpacing.m),
    child: Divider(),
  );
}

/// Lays buttons out two per row with equal widths; a lone last button takes
/// the whole row. Keeps every action the same size and aligned.
class _ButtonGrid extends StatelessWidget {
  const _ButtonGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += 2) {
      final pair = children.skip(i).take(2).toList();
      if (rows.isNotEmpty) rows.add(const SizedBox(height: AppSpacing.m));
      rows.add(
        Row(
          children: [
            for (var j = 0; j < pair.length; j++) ...[
              if (j > 0) const SizedBox(width: AppSpacing.m),
              Expanded(child: pair[j]),
            ],
          ],
        ),
      );
    }
    return Column(children: rows);
  }
}

enum _ActionKind { primary, secondary, destructive }

class _ActionButton extends ConsumerStatefulWidget {
  const _ActionButton({
    required this.appointment,
    required this.action,
    required this.kind,
  });

  final Appointment appointment;
  final AppointmentAction action;
  final _ActionKind kind;

  @override
  ConsumerState<_ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends ConsumerState<_ActionButton> {
  bool _running = false;

  bool get _destructive => _isDestructive(widget.action);

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
    final label = _running
        ? const SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Text(widget.action.label);

    return switch (widget.kind) {
      _ActionKind.primary => FilledButton(
        onPressed: _running ? null : _run,
        child: label,
      ),
      _ActionKind.secondary => FilledButton.tonal(
        style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
        onPressed: _running ? null : _run,
        child: label,
      ),
      _ActionKind.destructive => FilledButton.tonal(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 48),
          backgroundColor: AppStatusColors.of(context)
              .background(StatusTone.danger),
          foregroundColor: AppStatusColors.of(context)
              .foreground(StatusTone.danger),
        ),
        onPressed: _running ? null : _run,
        child: label,
      ),
    };
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({
    required this.change,
    required this.clock,
    required this.isLast,
  });

  final AppointmentStatusChange change;
  final BusinessClock clock;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final color = AppStatusColors.of(context)
        .foreground(appointmentTone(change.toStatus));
    final date = clock.dateOf(change.changedAt);
    final time = clock.timeOf(change.changedAt);
    final hasReason = change.reason != null && change.reason!.isNotEmpty;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 20,
            child: Column(
              children: [
                const SizedBox(height: 5),
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(width: 2, color: scheme.outlineVariant),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.l),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    change.toStatus.label,
                    style: theme.textTheme.titleSmall,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${clock.dayLabel(date)} · $time'
                    '${hasReason ? '\n${change.reason}' : ''}',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
