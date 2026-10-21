import '../../domain/entities/staff_member.dart';

StaffMember staffMemberFromJson(Map<String, dynamic> json) => StaffMember(
  id: json['id'] as String,
  displayName: json['displayName'] as String,
  active: json['status'] == 'ACTIVE',
  userId: json['userId'] as String?,
  schedule: [
    for (final row in (json['schedule'] as List<dynamic>? ?? const []))
      scheduleRangeFromJson(row as Map<String, dynamic>),
  ],
);

ScheduleRange scheduleRangeFromJson(Map<String, dynamic> json) => ScheduleRange(
  weekday: (json['weekday'] as num).toInt(),
  startsAt: json['startsAt'] as String,
  endsAt: json['endsAt'] as String,
);

Map<String, dynamic> createStaffBody(StaffMemberInput input) => {
  'displayName': input.displayName.trim(),
  if (input.userId.trim().isNotEmpty) 'userId': input.userId.trim(),
};

Map<String, dynamic> updateStaffBody(StaffMemberInput input) => {
  'displayName': input.displayName.trim(),
  'userId': input.userId.trim().isEmpty ? null : input.userId.trim(),
};

TimeOff timeOffFromJson(Map<String, dynamic> json) => TimeOff(
  id: json['id'] as String,
  staffMemberId: json['staffMemberId'] as String,
  startsAt: DateTime.parse(json['startsAt'] as String).toUtc(),
  endsAt: DateTime.parse(json['endsAt'] as String).toUtc(),
  reason: json['reason'] as String?,
);

Map<String, dynamic> createTimeOffBody({
  required DateTime startsAt,
  required DateTime endsAt,
  String? reason,
}) {
  final trimmed = reason?.trim() ?? '';
  return {
    'startsAt': startsAt.toUtc().toIso8601String(),
    'endsAt': endsAt.toUtc().toIso8601String(),
    if (trimmed.isNotEmpty) 'reason': trimmed,
  };
}
