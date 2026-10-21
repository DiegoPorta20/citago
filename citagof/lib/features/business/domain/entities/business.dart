class Business {
  const Business({
    required this.id,
    required this.name,
    required this.country,
    required this.currency,
    required this.timezone,
    required this.hours,
    this.phone,
    this.email,
  });

  final String id;
  final String name;

  final String country;

  final String currency;

  final String timezone;

  final String? phone;
  final String? email;

  final List<ScheduleRange> hours;
}

class ScheduleRange {
  const ScheduleRange({
    required this.weekday,
    required this.startsAt,
    required this.endsAt,
  });

  final int weekday;

  final String startsAt;

  final String endsAt;

  int get startMinutes => _toMinutes(startsAt);

  int get endMinutes => _toMinutes(endsAt);

  static int _toMinutes(String time) {
    final parts = time.split(':');
    return int.parse(parts[0]) * 60 + int.parse(parts[1]);
  }
}

class BusinessInput {
  const BusinessInput({
    required this.name,
    required this.timezone,
    this.phone = '',
    this.email = '',
  });

  final String name;
  final String timezone;
  final String phone;
  final String email;
}

String? validateBusinessHours(List<ScheduleRange> ranges) {
  for (final range in ranges) {
    if (range.startMinutes >= range.endMinutes) {
      return 'Cada franja debe empezar antes de terminar.';
    }
  }
  for (var weekday = 1; weekday <= 7; weekday++) {
    final day = ranges.where((r) => r.weekday == weekday).toList()
      ..sort((a, b) => a.startMinutes.compareTo(b.startMinutes));
    for (var i = 1; i < day.length; i++) {
      if (day[i].startMinutes < day[i - 1].endMinutes) {
        return 'Las franjas de un mismo día no pueden solaparse.';
      }
    }
  }
  return null;
}
