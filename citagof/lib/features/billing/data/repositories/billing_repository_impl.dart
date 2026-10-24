import 'package:dio/dio.dart';

import '../../../../core/network/api_response.dart';
import '../../domain/entities/subscription.dart';
import '../../domain/repositories/billing_repository.dart';
import '../models/billing_model.dart';

class BillingRepositoryImpl implements BillingRepository {
  const BillingRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<Plan>> plans() => _guard(() async {
    final response = await _dio.get<dynamic>('/billing/plans');
    return [
      for (final row in unwrapData<List<dynamic>>(response))
        planFromJson(row as Map<String, dynamic>),
    ];
  });

  @override
  Future<Subscription> subscription() => _guard(() async {
    final response = await _dio.get<dynamic>('/billing/subscription');
    return subscriptionFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<Subscription> choosePlan(PlanCode code) => _guard(() async {
    final response = await _dio.put<dynamic>(
      '/billing/subscription/plan',
      data: choosePlanBody(code),
    );
    return subscriptionFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
