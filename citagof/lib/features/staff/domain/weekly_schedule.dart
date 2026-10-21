import 'entities/staff_member.dart';

class TimeRange {
  const TimeRange({required this.start, required this.end});

  final String start;

  final String end;

  int? get startMinutes => _toMinutes(start);

  int? get endMinutes => _toMinutes(end);

  TimeRange copyWith({String? start, String? end}) =>
      TimeRange(start: start ?? this.start, end: end ?? this.end);

  static int? _toMinutes(String value) {
    final match = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$').firstMatch(value);
    if (match == null) return null;
    return int.parse(match.group(1)!) * 60 + int.parse(match.group(2)!);
  }
}

class WeekdaySchedule {
  const WeekdaySchedule({
    required this.weekday,
    required this.working,
    required this.ranges,
  });

  final int weekday;
  final bool working;
  final List<TimeRange> ranges;

  WeekdaySchedule copyWith({bool? working, List<TimeRange>? ranges}) =>
      WeekdaySchedule(
        weekday: weekday,
        working: working ?? this.working,
        ranges: ranges ?? this.ranges,
      );
}

const int maxRangesPerWeekday = 4;

abstract final class WeeklySchedule {
  static List<WeekdaySchedule> fromRanges(List<ScheduleRange> saved) {
    return [
      for (var weekday = 1; weekday <= 7; weekday++) _buildDay(weekday, saved),
    ];
  }

  static WeekdaySchedule _buildDay(int weekday, List<ScheduleRange> saved) {
    final ranges = saved
        .where((range) => range.weekday == weekday)
        .map((range) => TimeRange(start: range.startsAt, end: range.endsAt))
        .toList();
    return WeekdaySchedule(
      weekday: weekday,
      working: ranges.isNotEmpty,
      ranges: ranges.isEmpty
          ? const [TimeRange(start: '09:00', end: '18:00')]
          : ranges,
    );
  }

  static ScheduleError? validate(List<WeekdaySchedule> week) {
    for (final day in week) {
      if (!day.working) continue;
      if (day.ranges.isEmpty) {
        return ScheduleError(
          weekday: day.weekday,
          kind: ScheduleErrorKind.empty,
        );
      }
      if (day.ranges.length > maxRangesPerWeekday) {
        return ScheduleError(
          weekday: day.weekday,
          kind: ScheduleErrorKind.tooMany,
        );
      }
      for (final range in day.ranges) {
        final start = range.startMinutes;
        final end = range.endMinutes;
        if (start == null || end == null) {
          return ScheduleError(
            weekday: day.weekday,
            kind: ScheduleErrorKind.malformed,
          );
        }
        if (start >= end) {
          return ScheduleError(
            weekday: day.weekday,
            kind: ScheduleErrorKind.startNotBeforeEnd,
          );
        }
      }
      if (_hasOverlap(day.ranges)) {
        return ScheduleError(
          weekday: day.weekday,
          kind: ScheduleErrorKind.overlap,
        );
      }
    }
    return null;
  }

  static bool _hasOverlap(List<TimeRange> ranges) {
    final sorted = [...ranges]
      ..sort((a, b) => (a.startMinutes ?? 0).compareTo(b.startMinutes ?? 0));
    for (var i = 1; i < sorted.length; i++) {
      final previousEnd = sorted[i - 1].endMinutes ?? 0;
      final currentStart = sorted[i].startMinutes ?? 0;
      if (currentStart < previousEnd) return true;
    }
    return false;
  }

  static List<Map<String, dynamic>> toPayloadRanges(
    List<WeekdaySchedule> week,
  ) {
    return [
      for (final day in week)
        if (day.working)
          for (final range in day.ranges)
            {
              'weekday': day.weekday,
              'startsAt': range.start,
              'endsAt': range.end,
            },
    ];
  }
}

enum ScheduleErrorKind { empty, tooMany, malformed, startNotBeforeEnd, overlap }

class ScheduleError {
  const ScheduleError({required this.weekday, required this.kind});

  final int weekday;
  final ScheduleErrorKind kind;

  static const _weekdayNames = [
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
    'domingo',
  ];

  String get message {
    final name = _weekdayNames[weekday - 1];
    return switch (kind) {
      ScheduleErrorKind.empty =>
        'El $name está marcado como laborable pero no tiene tramos.',
      ScheduleErrorKind.tooMany =>
        'El $name tiene demasiados tramos (máximo $maxRangesPerWeekday).',
      ScheduleErrorKind.malformed =>
        'Revisa las horas del $name: deben tener el formato HH:mm.',
      ScheduleErrorKind.startNotBeforeEnd =>
        'En $name, la hora de inicio debe ser anterior a la de fin.',
      ScheduleErrorKind.overlap => 'En $name hay tramos que se solapan.',
    };
  }
}
