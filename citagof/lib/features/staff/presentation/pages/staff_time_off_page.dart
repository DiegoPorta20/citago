import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/time/business_clock.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_banner.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/icon_badge.dart';
import '../../../../core/widgets/list_card.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/staff_member.dart';
import '../providers/staff_providers.dart';

class StaffTimeOffPage extends ConsumerWidget {
  const StaffTimeOffPage({super.key, required this.staffId});

  final String staffId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clock = ref.watch(businessClockProvider);
    final today = clock.today();
    final from = clock.dayRangeUtc(clock.addDays(today, -365)).from;
    final to = clock.dayRangeUtc(clock.addDays(today, 365)).to;
    final query = TimeOffQuery(staffMemberId: staffId, from: from, to: to);
    final timeOff = ref.watch(staffTimeOffProvider(query));

    return Scaffold(
      appBar: AppBar(title: const Text('Ausencias')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _add(context, ref, query),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Agregar'),
      ),
      body: Column(
        children: [
          const _Ap19Note(),
          Expanded(
            child: timeOff.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => ErrorView(
                error: error,
                onRetry: () => ref.invalidate(staffTimeOffProvider(query)),
              ),
              data: (items) => items.isEmpty
                  ? const _EmptyState()
                  : RefreshIndicator(
                      onRefresh: () async =>
                          ref.invalidate(staffTimeOffProvider(query)),
                      child: _TimeOffList(
                        items: items,
                        clock: clock,
                        today: today,
                        onDelete: (item) => _delete(context, ref, query, item),
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _add(
    BuildContext context,
    WidgetRef ref,
    TimeOffQuery query,
  ) async {
    final clock = ref.read(businessClockProvider);
    final result = await showDialog<_TimeOffDraft>(
      context: context,
      builder: (context) => _AddTimeOffDialog(clock: clock),
    );
    if (result == null || !context.mounted) return;

    final startsAt = clock.dayRangeUtc(result.startDate).from;
    final endsAt = clock.dayRangeUtc(result.endDate).to;

    try {
      await ref.read(addTimeOffUseCaseProvider)(
        query.staffMemberId,
        startsAt: startsAt,
        endsAt: endsAt,
        reason: result.reason,
      );
      invalidateStaffFrom(ref, id: query.staffMemberId);
      ref.invalidate(staffTimeOffProvider(query));
    } on Object catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(failureMessage(error))));
    }
  }

  Future<void> _delete(
    BuildContext context,
    WidgetRef ref,
    TimeOffQuery query,
    TimeOff item,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Quitar la ausencia?'),
        content: const Text(
          'El profesional volverá a aceptar reservas en ese periodo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Quitar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(removeTimeOffUseCaseProvider)(
        query.staffMemberId,
        item.id,
      );
      invalidateStaffFrom(ref, id: query.staffMemberId);
      ref.invalidate(staffTimeOffProvider(query));
    } on Object catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(failureMessage(error))));
    }
  }
}

class _Ap19Note extends StatelessWidget {
  const _Ap19Note();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.xs,
        AppSpacing.page,
        AppSpacing.s,
      ),
      child: AppCard(
        color: scheme.surfaceContainer,
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.info_outline_rounded,
              size: 20,
              color: scheme.onSurfaceVariant,
            ),
            const SizedBox(width: AppSpacing.m),
            Expanded(
              child: Text(
                'Agregar una ausencia solo bloquea reservas nuevas. Las citas ya '
                'agendadas en ese periodo no se cancelan: coordínalas con cada '
                'cliente.',
                style: theme.textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TimeOffList extends StatelessWidget {
  const _TimeOffList({
    required this.items,
    required this.clock,
    required this.today,
    required this.onDelete,
  });

  final List<TimeOff> items;
  final BusinessClock clock;
  final String today;
  final ValueChanged<TimeOff> onDelete;

  @override
  Widget build(BuildContext context) {
    final upcoming = <TimeOff>[];
    final past = <TimeOff>[];
    for (final item in items) {
      final lastDay = clock.dateOf(
        item.endsAt.subtract(const Duration(minutes: 1)),
      );
      if (lastDay.compareTo(today) >= 0) {
        upcoming.add(item);
      } else {
        past.add(item);
      }
    }
    upcoming.sort((a, b) => a.startsAt.compareTo(b.startsAt));
    past.sort((a, b) => b.startsAt.compareTo(a.startsAt));

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.s,
        AppSpacing.page,
        104,
      ),
      children: [
        if (upcoming.isNotEmpty) const _Heading('Próximas'),
        for (final item in upcoming)
          _TimeOffTile(item: item, clock: clock, onDelete: onDelete),
        if (past.isNotEmpty) const _Heading('Pasadas'),
        for (final item in past)
          _TimeOffTile(
            item: item,
            clock: clock,
            onDelete: onDelete,
            past: true,
          ),
      ],
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.s, bottom: AppSpacing.m),
      child: Text(title, style: Theme.of(context).textTheme.titleSmall),
    );
  }
}

class _TimeOffTile extends StatelessWidget {
  const _TimeOffTile({
    required this.item,
    required this.clock,
    required this.onDelete,
    this.past = false,
  });

  final TimeOff item;
  final BusinessClock clock;
  final ValueChanged<TimeOff> onDelete;
  final bool past;

  @override
  Widget build(BuildContext context) {
    final firstDay = clock.dateOf(item.startsAt);
    final lastDay = clock.dateOf(
      item.endsAt.subtract(const Duration(minutes: 1)),
    );
    final label = firstDay == lastDay
        ? BusinessClock.longDateCapitalized(firstDay)
        : '${BusinessClock.shortDate(firstDay)} – '
              '${BusinessClock.shortDate(lastDay)}';
    final hasReason = item.reason != null && item.reason!.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.m),
      child: ListCard(
        leading: const IconBadge(icon: Icons.event_busy_outlined),
        title: label,
        subtitle: hasReason ? ListCardSubtitle(item.reason!) : null,
        dimmed: past,
        padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
        trailing: IconButton(
          tooltip: 'Quitar',
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          icon: const Icon(Icons.delete_outline_rounded),
          onPressed: () => onDelete(item),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const EmptyState(
      icon: Icons.event_available_rounded,
      title: 'Sin ausencias registradas.',
      message: 'Agrega una con "Agregar".',
    );
  }
}

class _TimeOffDraft {
  const _TimeOffDraft({
    required this.startDate,
    required this.endDate,
    required this.reason,
  });

  final String startDate;
  final String endDate;
  final String reason;
}

class _AddTimeOffDialog extends StatefulWidget {
  const _AddTimeOffDialog({required this.clock});

  final BusinessClock clock;

  @override
  State<_AddTimeOffDialog> createState() => _AddTimeOffDialogState();
}

class _AddTimeOffDialogState extends State<_AddTimeOffDialog> {
  late String _start = widget.clock.today();
  late String _end = widget.clock.today();
  final _reason = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pickDate({required bool isStart}) async {
    final initial = _parse(isStart ? _start : _end);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.utc(2020),
      lastDate: DateTime.utc(2100),
    );
    if (picked == null) return;
    final value = _format(picked);
    setState(() {
      if (isStart) {
        _start = value;
        if (_end.compareTo(_start) < 0) _end = value;
      } else {
        _end = value;
      }
      _error = null;
    });
  }

  void _submit() {
    if (_end.compareTo(_start) < 0) {
      setState(
        () => _error = 'La fecha de fin no puede ser anterior al inicio.',
      );
      return;
    }
    Navigator.pop(
      context,
      _TimeOffDraft(startDate: _start, endDate: _end, reason: _reason.text),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Nueva ausencia'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.today),
              title: const Text('Desde'),
              subtitle: Text(BusinessClock.longDate(_start)),
              onTap: () => _pickDate(isStart: true),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.event),
              title: const Text('Hasta'),
              subtitle: Text(BusinessClock.longDate(_end)),
              onTap: () => _pickDate(isStart: false),
            ),
            TextField(
              controller: _reason,
              maxLength: 255,
              decoration: const InputDecoration(labelText: 'Motivo (opcional)'),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.s),
              ErrorBanner(_error!),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
          onPressed: _submit,
          child: const Text('Agregar'),
        ),
      ],
    );
  }

  static DateTime _parse(String value) {
    final p = value.split('-');
    return DateTime.utc(int.parse(p[0]), int.parse(p[1]), int.parse(p[2]));
  }

  static String _format(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';
}
