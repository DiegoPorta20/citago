import 'appointment_status.dart';

class NamedRef {
  const NamedRef({required this.id, required this.name});

  final String id;
  final String name;
}

class AppointmentStatusChange {
  const AppointmentStatusChange({
    required this.toStatus,
    required this.changedAt,
    this.fromStatus,
    this.reason,
  });

  final AppointmentStatus? fromStatus;
  final AppointmentStatus toStatus;

  final DateTime changedAt;
  final String? reason;
}

class Appointment {
  const Appointment({
    required this.id,
    required this.status,
    required this.startAt,
    required this.endAt,
    required this.price,
    this.notes,
    this.client,
    this.service,
    this.staffMember,
    this.cancellationReason,
    this.history = const [],
  });

  final String id;
  final AppointmentStatus status;

  final DateTime startAt;

  final DateTime endAt;

  final String price;

  final String? notes;
  final NamedRef? client;
  final NamedRef? service;
  final NamedRef? staffMember;
  final String? cancellationReason;

  final List<AppointmentStatusChange> history;
}
