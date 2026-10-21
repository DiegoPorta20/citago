import 'package:dio/dio.dart';

import '../../../../core/network/api_response.dart';
import '../../domain/entities/sale.dart';
import '../../domain/repositories/sale_repository.dart';
import '../models/sale_model.dart';

class SaleRepositoryImpl implements SaleRepository {
  const SaleRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<Sale> register(RegisterSaleInput input) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/sales',
      data: registerSaleBody(input),
    );
    return saleFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Paged<Sale>> list({
    required DateTime from,
    required DateTime to,
    SaleStatus? status,
    int page = 1,
    int limit = 20,
  }) => _guard(() async {
    final response = await _dio.get<dynamic>(
      '/sales',
      queryParameters: {
        'page': page,
        'limit': limit,
        'from': from.toUtc().toIso8601String(),
        'to': to.toUtc().toIso8601String(),
        'status': ?status?.wire,
      },
    );
    return unwrapPage(response, saleFromJson);
  });

  @override
  Future<Sale> get(String id) => _guard(() async {
    final response = await _dio.get<dynamic>('/sales/$id');
    return saleFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Sale> pay(String id, PaymentMethod method) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/sales/$id/pay',
      data: paySaleBody(method),
    );
    return saleFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Sale> cancel(String id, String reason) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/sales/$id/cancel',
      data: voidSaleBody(reason),
    );
    return saleFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Sale> refund(String id, String reason) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/sales/$id/refund',
      data: voidSaleBody(reason),
    );
    return saleFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
