import '../entities/appointment.dart';
import '../entities/appointment_status.dart';
import '../entities/availability.dart';
import '../repositories/appointment_repository.dart';

class ListAgendaUseCase {
  const ListAgendaUseCase(this._repository);

  final AppointmentRepository _repository;

  Future<List<Appointment>> call({
    required DateTime from,
    required DateTime to,
    String? staffMemberId,
  }) => _repository.agenda(from: from, to: to, staffMemberId: staffMemberId);
}

class GetAppointmentUseCase {
  const GetAppointmentUseCase(this._repository);

  final AppointmentRepository _repository;

  Future<Appointment> call(String id) => _repository.get(id);
}

class GetAvailabilityUseCase {
  const GetAvailabilityUseCase(this._repository);

  final AppointmentRepository _repository;

  Future<Availability> call({
    required String staffMemberId,
    required String serviceId,
    required String date,
  }) => _repository.availability(
    staffMemberId: staffMemberId,
    serviceId: serviceId,
    date: date,
  );
}

class BookAppointmentUseCase {
  const BookAppointmentUseCase(this._repository);

  final AppointmentRepository _repository;

  Future<Appointment> call(BookAppointmentInput input) =>
      _repository.book(input);
}

class RescheduleAppointmentUseCase {
  const RescheduleAppointmentUseCase(this._repository);

  final AppointmentRepository _repository;

  Future<Appointment> call(String id, RescheduleInput input) =>
      _repository.reschedule(id, input);
}

class TransitionAppointmentUseCase {
  const TransitionAppointmentUseCase(this._repository);

  final AppointmentRepository _repository;

  Future<Appointment> call(
    String id,
    AppointmentAction action, {
    String? reason,
  }) => _repository.transition(id, action, reason: reason);
}
