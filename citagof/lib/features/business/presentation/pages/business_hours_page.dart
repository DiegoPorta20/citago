import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/bottom_action_bar.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/business.dart';
import '../providers/business_providers.dart';

const _weekdayLabels = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

class _EditableRange {
  _EditableRange({required this.startsAt, required this.endsAt});

  String startsAt;
  String endsAt;
}

class BusinessHoursPage extends ConsumerWidget {
  const BusinessHoursPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final business = ref.watch(businessProvider);
    return business.when(
      loading: () => Scaffold(
        appBar: AppBar(title: const Text('Horario de atención')),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('Horario de atención')),
        body: ErrorView(
          error: error,
          onRetry: () => ref.invalidate(businessProvider),
        ),
      ),
      data: (data) => _HoursForm(hours: data.hours),
    );
  }
}

class _HoursForm extends ConsumerStatefulWidget {
  const _HoursForm({required this.hours});

  final List<ScheduleRange> hours;

  @override
  ConsumerState<_HoursForm> createState() => _HoursFormState();
}

class _HoursFormState extends ConsumerState<_HoursForm> {
  late final Map<int, List<_EditableRange>> _byDay;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _byDay = {for (var day = 1; day <= 7; day++) day: []};
    for (final range in widget.hours) {
      _byDay[range.weekday]?.add(
        _EditableRange(startsAt: range.startsAt, endsAt: range.endsAt),
      );
    }
    for (final ranges in _byDay.values) {
      ranges.sort((a, b) => a.startsAt.compareTo(b.startsAt));
    }
  }

  List<ScheduleRange> _collect() => [
    for (var day = 1; day <= 7; day++)
      for (final range in _byDay[day]!)
        ScheduleRange(
          weekday: day,
          startsAt: range.startsAt,
          endsAt: range.endsAt,
        ),
  ];

  Future<void> _save() async {
    final ranges = _collect();
    final validation = validateBusinessHours(ranges);
    if (validation != null) {
      setState(() => _error = validation);
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ref.read(replaceBusinessHoursUseCaseProvider)(ranges);
      ref.invalidate(businessProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Horario guardado.')));
      context.pop();
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failure.message;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failureMessage(error);
      });
    }
  }

  Future<void> _pickTime(_EditableRange range, {required bool start}) async {
    final initial = _parseTimeOfDay(start ? range.startsAt : range.endsAt);
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (picked == null) return;
    setState(() {
      final text = _formatTimeOfDay(picked);
      if (start) {
        range.startsAt = text;
      } else {
        range.endsAt = text;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Horario de atención')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.page,
                  AppSpacing.s,
                  AppSpacing.page,
                  AppSpacing.s,
                ),
                children: [for (var day = 1; day <= 7; day++) _dayCard(day)],
              ),
            ),
            BottomActionBar(
              error: _error,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      )
                    : const Text('Guardar horario'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dayCard(int day) {
    final ranges = _byDay[day]!;
    final open = ranges.isNotEmpty;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: AppCard(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.s,
          AppSpacing.xs,
          AppSpacing.s,
          AppSpacing.s,
        ),
        child: Column(
          children: [
            SwitchListTile(
              title: Text(_weekdayLabels[day - 1]),
              subtitle: Text(open ? 'Abierto' : 'Cerrado'),
              value: open,
              onChanged: _saving
                  ? null
                  : (value) => setState(() {
                      if (value) {
                        ranges.add(
                          _EditableRange(startsAt: '09:00', endsAt: '18:00'),
                        );
                      } else {
                        ranges.clear();
                      }
                    }),
            ),
            if (open)
              for (final range in ranges) _rangeRow(day, range),
            if (open)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: _saving
                      ? null
                      : () => setState(
                          () => ranges.add(
                            _EditableRange(startsAt: '09:00', endsAt: '18:00'),
                          ),
                        ),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Agregar franja'),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _rangeRow(int day, _EditableRange range) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _saving ? null : () => _pickTime(range, start: true),
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
              child: Text(range.startsAt),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 8),
            child: Text('a'),
          ),
          Expanded(
            child: OutlinedButton(
              onPressed: _saving ? null : () => _pickTime(range, start: false),
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
              child: Text(range.endsAt),
            ),
          ),
          IconButton(
            tooltip: 'Quitar franja',
            iconSize: 24,
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            onPressed: _saving
                ? null
                : () => setState(() => _byDay[day]!.remove(range)),
            icon: const Icon(Icons.delete_outline),
          ),
        ],
      ),
    );
  }

  static TimeOfDay _parseTimeOfDay(String time) {
    final parts = time.split(':');
    return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
  }

  static String _formatTimeOfDay(TimeOfDay time) =>
      '${time.hour.toString().padLeft(2, '0')}:'
      '${time.minute.toString().padLeft(2, '0')}';
}
