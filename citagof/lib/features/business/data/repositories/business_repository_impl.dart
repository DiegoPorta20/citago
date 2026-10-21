import 'package:dio/dio.dart';

import '../../../../core/network/api_response.dart';
import '../../domain/entities/business.dart';
import '../../domain/repositories/business_repository.dart';
import '../models/business_model.dart';

class BusinessRepositoryImpl implements BusinessRepository {
  const BusinessRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<Business> get() => _guard(() async {
    final response = await _dio.get<dynamic>('/business');
    return businessFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Business> update(BusinessInput input) => _guard(() async {
    final response = await _dio.patch<dynamic>(
      '/business',
      data: updateBusinessBody(input),
    );
    return businessFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Business> replaceHours(List<ScheduleRange> ranges) => _guard(() async {
    final response = await _dio.put<dynamic>(
      '/business/hours',
      data: replaceHoursBody(ranges),
    );
    return businessFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
