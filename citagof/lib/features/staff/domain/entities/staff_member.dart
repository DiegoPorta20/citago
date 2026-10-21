class StaffMember {
  const StaffMember({
    required this.id,
    required this.displayName,
    required this.active,
    this.userId,
    this.schedule = const [],
  });

  final String id;
  final String displayName;
  final bool active;

  final String? userId;

  final List<ScheduleRange> schedule;
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
}

class StaffMemberInput {
  const StaffMemberInput({required this.displayName, this.userId = ''});

  final String displayName;

  final String userId;
}

class TimeOff {
  const TimeOff({
    required this.id,
    required this.staffMemberId,
    required this.startsAt,
    required this.endsAt,
    this.reason,
  });

  final String id;
  final String staffMemberId;

  final DateTime startsAt;

  final DateTime endsAt;

  final String? reason;
}

class TimeOffInput {
  const TimeOffInput({
    required this.startDate,
    required this.endDate,
    this.reason = '',
  });

  final String startDate;

  final String endDate;

  final String reason;
}
