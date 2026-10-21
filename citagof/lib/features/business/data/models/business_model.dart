import '../../domain/entities/business.dart';

Business businessFromJson(Map<String, dynamic> json) => Business(
  id: json['id'] as String,
  name: json['name'] as String,
  country: json['country'] as String,
  currency: json['currency'] as String,
  timezone: json['timezone'] as String,
  phone: json['phone'] as String?,
  email: json['email'] as String?,
  hours: [
    for (final row in (json['hours'] as List<dynamic>? ?? const []))
      scheduleRangeFromJson(row as Map<String, dynamic>),
  ],
);

ScheduleRange scheduleRangeFromJson(Map<String, dynamic> json) => ScheduleRange(
  weekday: json['weekday'] as int,
  startsAt: json['startsAt'] as String,
  endsAt: json['endsAt'] as String,
);

Map<String, dynamic> updateBusinessBody(BusinessInput input) => {
  'name': input.name.trim(),
  'timezone': input.timezone,
  'phone': input.phone.trim().isEmpty ? null : input.phone.trim(),
  'email': input.email.trim().isEmpty ? null : input.email.trim(),
};

Map<String, dynamic> replaceHoursBody(List<ScheduleRange> ranges) => {
  'ranges': [
    for (final range in ranges)
      {
        'weekday': range.weekday,
        'startsAt': range.startsAt,
        'endsAt': range.endsAt,
      },
  ],
};
