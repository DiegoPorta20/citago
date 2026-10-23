import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/icon_badge.dart';
import '../../../../core/widgets/initials_avatar.dart';
import '../../../../core/widgets/list_card.dart';
import '../../../../core/widgets/section_header.dart';
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
    final scheme = theme.colorScheme;
    final member = widget.member;
    final colors = AppStatusColors.of(context);
    final deactivating = member.active;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.s,
        AppSpacing.page,
        AppSpacing.xxxl,
      ),
      children: [
        AppCard(
          padding: const EdgeInsets.all(AppSpacing.xl),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              scheme.primaryContainer.withValues(alpha: 0.7),
              scheme.surfaceContainerLow,
            ],
          ),
          child: Row(
            children: [
              InitialsAvatar(name: member.displayName, radius: 30),
              const SizedBox(width: AppSpacing.l),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      member.displayName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.headlineSmall,
                    ),
                    const SizedBox(height: AppSpacing.s),
                    StatusBadge(active: member.active),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.l),
        ListCard(
          leading: const IconBadge(icon: Icons.schedule_rounded),
          title: 'Horario semanal',
          subtitle: const ListCardSubtitle(
            'Días laborables y tramos de atención',
          ),
          onTap: () => context.push(StaffRoutes.schedule(member.id)),
        ),
        const SizedBox(height: AppSpacing.m),
        ListCard(
          leading: const IconBadge(icon: Icons.event_busy_outlined),
          title: 'Ausencias',
          subtitle: const ListCardSubtitle('Vacaciones y días libres'),
          onTap: () => context.push(StaffRoutes.timeOff(member.id)),
        ),
        const SizedBox(height: AppSpacing.xxl),
        const SectionHeader(title: 'Horario'),
        const SizedBox(height: AppSpacing.m),
        _ScheduleSummary(member: member),
        const SizedBox(height: AppSpacing.xxl),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            foregroundColor: deactivating
                ? colors.foreground(StatusTone.danger)
                : scheme.onSurface,
            side: BorderSide(
              color: deactivating
                  ? colors.foreground(StatusTone.danger).withValues(alpha: 0.5)
                  : scheme.outline,
            ),
          ),
          onPressed: _busy ? null : _toggleStatus,
          icon: _busy
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                )
              : Icon(
                  member.active
                      ? Icons.block_rounded
                      : Icons.check_circle_outline_rounded,
                ),
          label: Text(member.active ? 'Desactivar' : 'Reactivar'),
        ),
      ],
    );
  }
}

class _ScheduleSummary extends StatelessWidget {
  const _ScheduleSummary({required this.member});

  final StaffMember member;

  static const _names = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    if (member.schedule.isEmpty) {
      return AppCard(
        child: Row(
          children: [
            Icon(Icons.info_outline_rounded, color: scheme.onSurfaceVariant),
            const SizedBox(width: AppSpacing.m),
            const Expanded(child: Text('Sin horario configurado.')),
          ],
        ),
      );
    }

    final week = WeeklySchedule.fromRanges(member.schedule);
    return AppCard(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.l,
        vertical: AppSpacing.s,
      ),
      child: Column(
        children: [
          for (var i = 0; i < week.length; i++) ...[
            if (i > 0) const Divider(),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  SizedBox(
                    width: 48,
                    child: Text(
                      _names[week[i].weekday - 1],
                      style: theme.textTheme.titleSmall,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      _daySummary(week[i].weekday, member.schedule),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: _isRest(week[i].weekday, member.schedule)
                            ? scheme.onSurfaceVariant
                            : scheme.onSurface,
                        fontFeatures: AppText.tabular,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  static bool _isRest(int weekday, List<ScheduleRange> schedule) =>
      !schedule.any((r) => r.weekday == weekday);

  static String _daySummary(int weekday, List<ScheduleRange> schedule) {
    final ranges = schedule.where((r) => r.weekday == weekday).toList()
      ..sort((a, b) => a.startsAt.compareTo(b.startsAt));
    if (ranges.isEmpty) return 'Descanso';
    return ranges.map((r) => '${r.startsAt}–${r.endsAt}').join('  ·  ');
  }
}
