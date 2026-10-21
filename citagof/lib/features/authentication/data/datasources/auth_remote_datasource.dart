import 'package:dio/dio.dart';

import '../../../../core/network/api_response.dart';
import '../../domain/entities/auth_session.dart';
import '../../domain/entities/business_registration.dart';
import '../models/session_model.dart';

class AuthRemoteDataSource {
  const AuthRemoteDataSource(this._dio);

  final Dio _dio;

  Future<TokenPairModel> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
      return TokenPairModel.fromJson(
        unwrapData<Map<String, dynamic>>(response),
      );
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<TokenPairModel> register(BusinessRegistration input) async {
    try {
      final response = await _dio.post<dynamic>(
        '/auth/register',
        data: {
          'businessName': input.businessName.trim(),
          'businessType': 'BARBERSHOP',
          'country': input.country.code,
          'currency': input.country.currency,
          'timezone': input.country.timezone,
          'ownerName': input.ownerName.trim(),
          'ownerEmail': input.ownerEmail.trim(),
          'password': input.password,
        },
      );
      return TokenPairModel.fromJson(
        unwrapData<Map<String, dynamic>>(response),
      );
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<List<TenantChoice>> tenants() async {
    try {
      final response = await _dio.get<dynamic>('/auth/tenants');
      return [
        for (final row in unwrapData<List<dynamic>>(response))
          tenantChoiceFromJson(row as Map<String, dynamic>),
      ];
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<TokenPairModel> switchTenant({
    required String tenantId,
    required String refreshToken,
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        '/auth/switch-tenant',
        data: {'tenantId': tenantId, 'refreshToken': refreshToken},
      );
      return TokenPairModel.fromJson(
        unwrapData<Map<String, dynamic>>(response),
      );
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SessionModel> me() async {
    try {
      final response = await _dio.get<dynamic>('/auth/me');
      return SessionModel.fromJson(unwrapData<Map<String, dynamic>>(response));
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<void> logout(String refreshToken) async {
    try {
      await _dio.post<dynamic>(
        '/auth/logout',
        data: {'refreshToken': refreshToken},
      );
    } on DioException {
      return;
    }
  }
}
