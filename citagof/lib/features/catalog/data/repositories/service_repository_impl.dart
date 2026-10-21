import 'package:dio/dio.dart';

import '../../../../core/network/api_response.dart';
import '../../domain/entities/service.dart';
import '../../domain/repositories/service_repository.dart';
import '../models/service_model.dart';

class ServiceRepositoryImpl implements ServiceRepository {
  const ServiceRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<Service>> list({bool activeOnly = false}) => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/services',
      queryParameters: {'limit': 100, if (activeOnly) 'status': 'ACTIVE'},
    );
    return unwrapPage(response, serviceFromJson).items;
  });

  @override
  Future<List<Service>> listAll({ServiceFilter filter = ServiceFilter.all}) =>
      _guard(() async {
        final status = filter.status;
        final response = await _dio.get<dynamic>(
          '/services',
          queryParameters: {'limit': 100, 'status': ?status},
        );
        return unwrapPage(response, serviceFromJson).items;
      });

  @override
  Future<Service> get(String id) => _guard(() async {
    final response = await _dio.get<dynamic>('/services/$id');
    return serviceFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Service> create(ServiceInput input) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/services',
      data: createServiceBody(input),
    );
    return serviceFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Service> update(String id, ServiceInput input) => _guard(() async {
    final response = await _dio.patch<dynamic>(
      '/services/$id',
      data: updateServiceBody(input),
    );
    return serviceFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Service> activate(String id) => _guard(() async {
    final response = await _dio.post<dynamic>('/services/$id/activate');
    return serviceFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Service> deactivate(String id) => _guard(() async {
    final response = await _dio.post<dynamic>('/services/$id/deactivate');
    return serviceFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
