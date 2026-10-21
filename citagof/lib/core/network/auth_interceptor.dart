import 'dart:async';

import 'package:dio/dio.dart';

import '../storage/token_storage.dart';

typedef TokenRefresher = Future<StoredTokens?> Function(String refreshToken);

class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required this._dio,
    required this._storage,
    required this._refresh,
    required this._onSessionExpired,
  });

  static const _retriedKey = 'auth_retried';
  static const _publicPaths = {
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/logout',
  };

  final Dio _dio;
  final TokenStorage _storage;
  final TokenRefresher _refresh;
  final void Function() _onSessionExpired;

  Future<StoredTokens?>? _inFlightRefresh;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (!_publicPaths.contains(options.path)) {
      final tokens = await _storage.read();
      if (tokens != null) {
        options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final request = err.requestOptions;
    final isExpiredToken =
        err.response?.statusCode == 401 &&
        !_publicPaths.contains(request.path) &&
        request.extra[_retriedKey] != true;

    if (!isExpiredToken) {
      return handler.next(err);
    }

    final tokens = await _recoverTokens(request);
    if (tokens == null) {
      return handler.next(err);
    }

    try {
      request.extra[_retriedKey] = true;
      request.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
      handler.resolve(await _dio.fetch<dynamic>(request));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  Future<StoredTokens?> _recoverTokens(RequestOptions failed) async {
    final current = await _storage.read();
    if (current == null) {
      return null;
    }

    final usedHeader = failed.headers['Authorization'];
    if (usedHeader != 'Bearer ${current.accessToken}') {
      return current;
    }

    final refreshed = await (_inFlightRefresh ??= _refreshOnce(current));
    return refreshed;
  }

  Future<StoredTokens?> _refreshOnce(StoredTokens current) async {
    try {
      final StoredTokens? next;
      try {
        next = await _refresh(current.refreshToken);
      } on Object {
        return null;
      }
      if (next == null) {
        await _storage.clear();
        _onSessionExpired();
        return null;
      }
      await _storage.write(next);
      return next;
    } finally {
      _inFlightRefresh = null;
    }
  }
}
