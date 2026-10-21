import 'package:dio/dio.dart';

import '../../../../core/network/api_response.dart';
import '../../domain/entities/staff_member.dart';
import '../../domain/repositories/staff_repository.dart';
import '../models/staff_member_model.dart';

class StaffRepositoryImpl implements StaffRepository {
  const StaffRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<StaffMember>> list() => _guard(() async {
    final response = await _dio.get<dynamic>('/staff');
    final data = unwrapData<List<dynamic>>(response);
    return [
      for (final row in data) staffMemberFromJson(row as Map<String, dynamic>),
    ];
  });

  @override
  Future<StaffMember> get(String id) => _guard(() async {
    final response = await _dio.get<dynamic>('/staff/$id');
    return staffMemberFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<StaffMember> create(StaffMemberInput input) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/staff',
      data: createStaffBody(input),
    );
    return staffMemberFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<StaffMember> update(String id, StaffMemberInput input) =>
      _guard(() async {
        final response = await _dio.patch<dynamic>(
          '/staff/$id',
          data: updateStaffBody(input),
        );
        return staffMemberFromJson(unwrapData<Map<String, dynamic>>(response));
      });

  @override
  Future<StaffMember> activate(String id) => _guard(() async {
    final response = await _dio.post<dynamic>('/staff/$id/activate');
    return staffMemberFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<StaffMember> deactivate(String id) => _guard(() async {
    final response = await _dio.post<dynamic>('/staff/$id/deactivate');
    return staffMemberFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<StaffMember> replaceSchedule(
    String id,
    List<Map<String, dynamic>> ranges,
  ) => _guard(() async {
    final response = await _dio.put<dynamic>(
      '/staff/$id/schedule',
      data: {'ranges': ranges},
    );
    return staffMemberFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<List<TimeOff>> listTimeOff(
    String id, {
    required DateTime from,
    required DateTime to,
  }) => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/staff/$id/time-off',
      queryParameters: {
        'from': from.toUtc().toIso8601String(),
        'to': to.toUtc().toIso8601String(),
      },
    );
    final data = unwrapData<List<dynamic>>(response);
    final items = [
      for (final row in data) timeOffFromJson(row as Map<String, dynamic>),
    ];
    items.sort((a, b) => a.startsAt.compareTo(b.startsAt));
    return items;
  });

  @override
  Future<TimeOff> addTimeOff(
    String id, {
    required DateTime startsAt,
    required DateTime endsAt,
    String? reason,
  }) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/staff/$id/time-off',
      data: createTimeOffBody(
        startsAt: startsAt,
        endsAt: endsAt,
        reason: reason,
      ),
    );
    return timeOffFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<void> removeTimeOff(String id, String timeOffId) => _guard(() async {
    await _dio.delete<dynamic>('/staff/$id/time-off/$timeOffId');
  });

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
