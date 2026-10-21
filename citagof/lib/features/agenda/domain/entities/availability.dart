class AvailabilitySlot {
  const AvailabilitySlot({
    required this.startAt,
    required this.endAt,
    required this.localTime,
  });

  final DateTime startAt;
  final DateTime endAt;

  final String localTime;
}

class Availability {
  const Availability({
    required this.date,
    required this.durationMinutes,
    required this.slots,
  });

  final String date;
  final int durationMinutes;
  final List<AvailabilitySlot> slots;
}

class BookAppointmentInput {
  const BookAppointmentInput({
    required this.clientId,
    required this.serviceId,
    required this.staffMemberId,
    required this.startAt,
    this.notes,
    this.allowOutsideSchedule = false,
  });

  final String clientId;
  final String serviceId;
  final String staffMemberId;

  final DateTime startAt;
  final String? notes;

  final bool allowOutsideSchedule;
}

class RescheduleInput {
  const RescheduleInput({
    this.startAt,
    this.staffMemberId,
    this.allowOutsideSchedule = false,
  });

  final DateTime? startAt;
  final String? staffMemberId;
  final bool allowOutsideSchedule;
}
