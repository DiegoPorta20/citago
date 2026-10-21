import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/token_storage.dart';
import 'api_response.dart';
import 'auth_interceptor.dart';

final tokenStorageProvider = Provider<TokenStorage>(
  (ref) => SecureTokenStorage(),
);

class SessionExpiredSignal extends Notifier<int> {
  @override
  int build() => 0;

  void notify() => state++;
}

final sessionExpiredSignalProvider =
    NotifierProvider<SessionExpiredSignal, int>(SessionExpiredSignal.new);

BaseOptions _baseOptions() => BaseOptions(
  baseUrl: AppConfig.apiBaseUrl,
  connectTimeout: AppConfig.connectTimeout,
  receiveTimeout: AppConfig.receiveTimeout,
  headers: const {'Accept': 'application/json'},
);

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(_baseOptions());
  dio.interceptors.add(
    AuthInterceptor(
      dio: dio,
      storage: ref.watch(tokenStorageProvider),
      refresh: _refreshTokens,
      onSessionExpired: () =>
          ref.read(sessionExpiredSignalProvider.notifier).notify(),
    ),
  );
  return dio;
});

Future<StoredTokens?> _refreshTokens(String refreshToken) async {
  final bare = Dio(_baseOptions());
  try {
    final response = await bare.post<dynamic>(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
    );
    final data = unwrapData<Map<String, dynamic>>(response);
    return StoredTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
  } on DioException catch (error) {
    if (error.response?.statusCode == 401) return null;
    rethrow;
  }
}
