import 'package:dio/dio.dart';

import '../../../../core/network/api_response.dart';
import '../../domain/entities/dashboard.dart';
import '../../domain/repositories/dashboard_repository.dart';
import '../models/dashboard_model.dart';

class DashboardRepositoryImpl implements DashboardRepository {
  const DashboardRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<BusinessDashboard> businessToday() =>
      _get('/dashboard/summary', businessDashboardFromJson);

  @override
  Future<OwnDashboard> ownToday() =>
      _get('/dashboard/me', ownDashboardFromJson);

  Future<T> _get<T>(String path, T Function(Map<String, dynamic>) parse) async {
    try {
      final response = await _dio.get<dynamic>(path);
      return parse(unwrapData<Map<String, dynamic>>(response));
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
