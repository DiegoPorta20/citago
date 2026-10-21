import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/staff_member.dart';
import '../../domain/weekly_schedule.dart';
import '../providers/staff_providers.dart';
import '../staff_routes.dart';
import 'staff_list_page.dart' show StatusBadge;

class StaffDetailPage extends ConsumerWidget {
  const StaffDetailPage({super.key, required this.staffId});

  final String staffId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final member = ref.watch(staffDetailProvider(staffId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profesional'),
        actions: [
          if (member.hasValue)
            IconButton(
              tooltip: 'Editar',
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => context.push(StaffRoutes.edit(staffId)),
            ),
        ],
      ),
      body: member.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(staffDetailProvider(staffId)),
        ),
        data: (data) => _Body(member: data),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.member});

  final StaffMember member;

  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  bool _busy = false;

  Future<void> _toggleStatus() async {
    final member = widget.member;
    final deactivating = member.active;
    if (deactivating) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('¿Desactivar profesional?'),
          content: Text(
            '${member.displayName} dejará de aceptar nuevas citas, pero '
            'conserva su historial y puedes reactivarlo cuando quieras.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Desactivar'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(setStaffStatusUseCaseProvider)(
        member.id,
        active: !member.active,
      );
      invalidateStaffFrom(ref, id: member.id);
    } on Object catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(failureMessage(error))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final member = widget.member;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Center(
          child: CircleAvatar(
            radius: 36,
            child: Text(
              _initials(member.displayName),
              style: theme.textTheme.titleLarge,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          member.displayName,
          textAlign: TextAlign.center,
          style: theme.textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        Center(child: StatusBadge(active: member.active)),
        const SizedBox(height: 24),
        _ScheduleSummary(member: member),
        const Divider(height: 32),
        ListTile(
          minTileHeight: 56,
          leading: const Icon(Icons.schedule),
          title: const Text('Horario semanal'),
          subtitle: const Text('Días laborables y tramos de atención'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.push(StaffRoutes.schedule(member.id)),
        ),
        ListTile(
          minTileHeight: 56,
          leading: const Icon(Icons.event_busy_outlined),
          title: const Text('Ausencias'),
          subtitle: const Text('Vacaciones y días libres'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.push(StaffRoutes.timeOff(member.id)),
        ),
        const Divider(height: 32),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
          ),
          onPressed: _busy ? null : _toggleStatus,
          icon: _busy
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                )
              : Icon(member.active ? Icons.block : Icons.check_circle_outline),
          label: Text(member.active ? 'Desactivar' : 'Reactivar'),
        ),
      ],
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}

class _ScheduleSummary extends StatelessWidget {
  const _ScheduleSummary({required this.member});

  final StaffMember member;

  static const _names = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  @override
  Widget build(BuildContext context) {
    final week = WeeklySchedule.fromRanges(member.schedule);
    final working = member.schedule.isNotEmpty;
    if (!working) {
      return const Text('Sin horario configurado.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final day in week)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 44,
                  child: Text(
                    _names[day.weekday - 1],
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                Expanded(
                  child: Text(_daySummary(day.weekday, member.schedule)),
                ),
              ],
            ),
          ),
      ],
    );
  }

  static String _daySummary(int weekday, List<ScheduleRange> schedule) {
    final ranges = schedule.where((r) => r.weekday == weekday).toList()
      ..sort((a, b) => a.startsAt.compareTo(b.startsAt));
    if (ranges.isEmpty) return 'Descanso';
    return ranges.map((r) => '${r.startsAt}–${r.endsAt}').join('  ·  ');
  }
}
