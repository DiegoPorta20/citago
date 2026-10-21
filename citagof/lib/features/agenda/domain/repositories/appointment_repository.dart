import '../entities/appointment.dart';
import '../entities/appointment_status.dart';
import '../entities/availability.dart';

abstract class AppointmentRepository {
  Future<List<Appointment>> agenda({
    required DateTime from,
    required DateTime to,
    String? staffMemberId,
  });

  Future<Appointment> get(String id);

  Future<Availability> availability({
    required String staffMemberId,
    required String serviceId,
    required String date,
  });

  Future<Appointment> book(BookAppointmentInput input);

  Future<Appointment> reschedule(String id, RescheduleInput input);

  Future<Appointment> transition(
    String id,
    AppointmentAction action, {
    String? reason,
  });
}
