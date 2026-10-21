import 'package:dio/dio.dart';

import '../../../../core/network/api_response.dart';
import '../../domain/entities/appointment.dart';
import '../../domain/entities/appointment_status.dart';
import '../../domain/entities/availability.dart';
import '../../domain/repositories/appointment_repository.dart';
import '../models/appointment_model.dart';

class AppointmentRepositoryImpl implements AppointmentRepository {
  const AppointmentRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<Appointment>> agenda({
    required DateTime from,
    required DateTime to,
    String? staffMemberId,
  }) => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/appointments',
      queryParameters: {
        'from': from.toUtc().toIso8601String(),
        'to': to.toUtc().toIso8601String(),
        'limit': 100,
        'staffMemberId': ?staffMemberId,
      },
    );
    final items = unwrapPage(response, appointmentFromJson).items;
    items.sort((a, b) => a.startAt.compareTo(b.startAt));
    return items;
  });

  @override
  Future<Appointment> get(String id) => _guard(() async {
    final response = await _dio.get<dynamic>('/appointments/$id');
    return appointmentFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Availability> availability({
    required String staffMemberId,
    required String serviceId,
    required String date,
  }) => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/appointments/availability',
      queryParameters: {
        'staffMemberId': staffMemberId,
        'serviceId': serviceId,
        'date': date,
      },
    );
    return availabilityFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Appointment> book(BookAppointmentInput input) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/appointments',
      data: bookAppointmentBody(input),
    );
    return appointmentFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Appointment> reschedule(String id, RescheduleInput input) =>
      _guard(() async {
        final response = await _dio.patch<dynamic>(
          '/appointments/$id',
          data: rescheduleBody(input),
        );
        return appointmentFromJson(unwrapData<Map<String, dynamic>>(response));
      });

  @override
  Future<Appointment> transition(
    String id,
    AppointmentAction action, {
    String? reason,
  }) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/appointments/$id/${_actionPath(action)}',
      data: reason == null ? null : {'reason': reason},
    );
    return appointmentFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  String _actionPath(AppointmentAction action) => switch (action) {
    AppointmentAction.confirm => 'confirm',
    AppointmentAction.arrive => 'arrive',
    AppointmentAction.start => 'start',
    AppointmentAction.complete => 'complete',
    AppointmentAction.cancel => 'cancel',
    AppointmentAction.noShow => 'no-show',
  };

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
