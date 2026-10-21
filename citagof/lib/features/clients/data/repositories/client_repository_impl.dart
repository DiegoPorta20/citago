import 'package:dio/dio.dart';

import '../../../../core/network/api_response.dart';
import '../../domain/entities/client.dart';
import '../../domain/repositories/client_repository.dart';
import '../models/client_model.dart';

class ClientRepositoryImpl implements ClientRepository {
  const ClientRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<Paged<Client>> list({String? query, int page = 1, int limit = 20}) =>
      _guard(() async {
        final response = await _dio.get<dynamic>(
          '/clients',
          queryParameters: {'page': page, 'limit': limit, 'q': ?query},
        );
        return unwrapPage(response, clientFromJson);
      });

  @override
  Future<Client> get(String id) => _guard(() async {
    final response = await _dio.get<dynamic>('/clients/$id');
    return clientFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Client> create(ClientInput input) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/clients',
      data: createClientBody(input),
    );
    return clientFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Client> update(String id, ClientInput input) => _guard(() async {
    final response = await _dio.patch<dynamic>(
      '/clients/$id',
      data: updateClientBody(input),
    );
    return clientFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<void> delete(String id) => _guard(() async {
    await _dio.delete<dynamic>('/clients/$id');
  });

  @override
  Future<Client> restore(String id) => _guard(() async {
    final response = await _dio.post<dynamic>('/clients/$id/restore');
    return clientFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
