import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/staff_member.dart';
import '../../domain/weekly_schedule.dart';
import '../providers/staff_providers.dart';

class StaffSchedulePage extends ConsumerWidget {
  const StaffSchedulePage({super.key, required this.staffId});

  final String staffId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final member = ref.watch(staffDetailProvider(staffId));
    return Scaffold(
      appBar: AppBar(title: const Text('Horario semanal')),
      body: member.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(staffDetailProvider(staffId)),
        ),
        data: (data) => _Editor(member: data),
      ),
    );
  }
}

class _Editor extends ConsumerStatefulWidget {
  const _Editor({required this.member});

  final StaffMember member;

  @override
  ConsumerState<_Editor> createState() => _EditorState();
}

class _EditorState extends ConsumerState<_Editor> {
  late List<WeekdaySchedule> _week;
  bool _saving = false;
  String? _error;

  static const _names = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo',
  ];

  @override
  void initState() {
    super.initState();
    _week = WeeklySchedule.fromRanges(widget.member.schedule);
  }

  void _setDay(int index, WeekdaySchedule day) {
    setState(() {
      _week = [..._week]..[index] = day;
      _error = null;
    });
  }

  Future<void> _pickTime(int dayIndex, int rangeIndex, bool isStart) async {
    final day = _week[dayIndex];
    final range = day.ranges[rangeIndex];
    final current = _parse(isStart ? range.start : range.end);
    final picked = await showTimePicker(
      context: context,
      initialTime: current,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (picked == null) return;
    final value = _format(picked);
    final ranges = [...day.ranges];
    ranges[rangeIndex] = isStart
        ? range.copyWith(start: value)
        : range.copyWith(end: value);
    _setDay(dayIndex, day.copyWith(ranges: ranges));
  }

  void _addRange(int dayIndex) {
    final day = _week[dayIndex];
    if (day.ranges.length >= maxRangesPerWeekday) return;
    final last = day.ranges.isEmpty ? null : day.ranges.last;
    final ranges = [
      ...day.ranges,
      TimeRange(start: last?.end ?? '09:00', end: '18:00'),
    ];
    _setDay(dayIndex, day.copyWith(ranges: ranges));
  }

  void _removeRange(int dayIndex, int rangeIndex) {
    final day = _week[dayIndex];
    final ranges = [...day.ranges]..removeAt(rangeIndex);
    _setDay(dayIndex, day.copyWith(ranges: ranges));
  }

  void _toggleWorking(int dayIndex, bool working) {
    final day = _week[dayIndex];
    final ranges = (working && day.ranges.isEmpty)
        ? const [TimeRange(start: '09:00', end: '18:00')]
        : day.ranges;
    _setDay(dayIndex, day.copyWith(working: working, ranges: ranges));
  }

  Future<void> _save() async {
    final error = WeeklySchedule.validate(_week);
    if (error != null) {
      setState(() => _error = error.message);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(replaceScheduleUseCaseProvider)(
        widget.member.id,
        WeeklySchedule.toPayloadRanges(_week),
      );
      invalidateStaffFrom(ref, id: widget.member.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Horario guardado.')));
      context.pop();
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failureMessage(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              children: [
                for (var i = 0; i < _week.length; i++)
                  _DayCard(
                    name: _names[i],
                    day: _week[i],
                    enabled: !_saving,
                    onToggleWorking: (value) => _toggleWorking(i, value),
                    onAddRange: () => _addRange(i),
                    onRemoveRange: (rangeIndex) => _removeRange(i, rangeIndex),
                    onPickStart: (rangeIndex) => _pickTime(i, rangeIndex, true),
                    onPickEnd: (rangeIndex) => _pickTime(i, rangeIndex, false),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_error != null) ...[
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                FilledButton(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                  ),
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        )
                      : const Text('Guardar horario'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static TimeOfDay _parse(String value) {
    final parts = value.split(':');
    return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
  }

  static String _format(TimeOfDay time) =>
      '${time.hour.toString().padLeft(2, '0')}:'
      '${time.minute.toString().padLeft(2, '0')}';
}

class _DayCard extends StatelessWidget {
  const _DayCard({
    required this.name,
    required this.day,
    required this.enabled,
    required this.onToggleWorking,
    required this.onAddRange,
    required this.onRemoveRange,
    required this.onPickStart,
    required this.onPickEnd,
  });

  final String name;
  final WeekdaySchedule day;
  final bool enabled;
  final ValueChanged<bool> onToggleWorking;
  final VoidCallback onAddRange;
  final ValueChanged<int> onRemoveRange;
  final ValueChanged<int> onPickStart;
  final ValueChanged<int> onPickEnd;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 8, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Text(day.working ? 'Laborable' : 'Descanso'),
                Switch(
                  value: day.working,
                  onChanged: enabled ? onToggleWorking : null,
                ),
              ],
            ),
            if (day.working) ...[
              for (var r = 0; r < day.ranges.length; r++)
                _RangeRow(
                  range: day.ranges[r],
                  enabled: enabled,
                  canRemove: day.ranges.length > 1,
                  onPickStart: () => onPickStart(r),
                  onPickEnd: () => onPickEnd(r),
                  onRemove: () => onRemoveRange(r),
                ),
              if (day.ranges.length < maxRangesPerWeekday)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: enabled ? onAddRange : null,
                    icon: const Icon(Icons.add),
                    label: const Text('Agregar tramo'),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RangeRow extends StatelessWidget {
  const _RangeRow({
    required this.range,
    required this.enabled,
    required this.canRemove,
    required this.onPickStart,
    required this.onPickEnd,
    required this.onRemove,
  });

  final TimeRange range;
  final bool enabled;
  final bool canRemove;
  final VoidCallback onPickStart;
  final VoidCallback onPickEnd;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              onPressed: enabled ? onPickStart : null,
              child: Text('Inicio ${range.start}'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              onPressed: enabled ? onPickEnd : null,
              child: Text('Fin ${range.end}'),
            ),
          ),
          IconButton(
            tooltip: 'Quitar tramo',
            iconSize: 22,
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            onPressed: (enabled && canRemove) ? onRemove : null,
            icon: const Icon(Icons.close),
          ),
        ],
      ),
    );
  }
}
