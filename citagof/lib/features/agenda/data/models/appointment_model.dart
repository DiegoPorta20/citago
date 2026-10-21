import '../../domain/entities/appointment.dart';
import '../../domain/entities/appointment_status.dart';
import '../../domain/entities/availability.dart';

NamedRef? _namedRefFromJson(Object? json) {
  if (json is! Map<String, dynamic>) return null;
  return NamedRef(id: json['id'] as String, name: json['name'] as String);
}

AppointmentStatusChange _statusChangeFromJson(Map<String, dynamic> json) =>
    AppointmentStatusChange(
      fromStatus: json['fromStatus'] == null
          ? null
          : AppointmentStatus.parse(json['fromStatus'] as String),
      toStatus: AppointmentStatus.parse(json['toStatus'] as String),
      changedAt: DateTime.parse(json['changedAt'] as String),
      reason: json['reason'] as String?,
    );

Appointment appointmentFromJson(Map<String, dynamic> json) {
  final rawHistory = json['history'];
  return Appointment(
    id: json['id'] as String,
    status: AppointmentStatus.parse(json['status'] as String),
    startAt: DateTime.parse(json['startAt'] as String),
    endAt: DateTime.parse(json['endAt'] as String),
    price: json['price'] as String,
    notes: json['notes'] as String?,
    client: _namedRefFromJson(json['client']),
    service: _namedRefFromJson(json['service']),
    staffMember: _namedRefFromJson(json['staffMember']),
    cancellationReason: json['cancellationReason'] as String?,
    history: rawHistory is List<dynamic>
        ? [
            for (final row in rawHistory)
              _statusChangeFromJson(row as Map<String, dynamic>),
          ]
        : const [],
  );
}

AvailabilitySlot _slotFromJson(Map<String, dynamic> json) => AvailabilitySlot(
  startAt: DateTime.parse(json['startAt'] as String),
  endAt: DateTime.parse(json['endAt'] as String),
  localTime: json['localTime'] as String,
);

Availability availabilityFromJson(Map<String, dynamic> json) => Availability(
  date: json['date'] as String,
  durationMinutes: json['durationMinutes'] as int,
  slots: [
    for (final row in json['slots'] as List<dynamic>)
      _slotFromJson(row as Map<String, dynamic>),
  ],
);

Map<String, dynamic> bookAppointmentBody(BookAppointmentInput input) => {
  'clientId': input.clientId,
  'serviceId': input.serviceId,
  'staffMemberId': input.staffMemberId,
  'startAt': input.startAt.toUtc().toIso8601String(),
  if (input.notes != null && input.notes!.trim().isNotEmpty)
    'notes': input.notes!.trim(),
  if (input.allowOutsideSchedule) 'allowOutsideSchedule': true,
};

Map<String, dynamic> rescheduleBody(RescheduleInput input) => {
  if (input.startAt != null)
    'startAt': input.startAt!.toUtc().toIso8601String(),
  if (input.staffMemberId != null) 'staffMemberId': input.staffMemberId,
  if (input.allowOutsideSchedule) 'allowOutsideSchedule': true,
};
