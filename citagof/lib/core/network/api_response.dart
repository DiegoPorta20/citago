import 'package:dio/dio.dart';

import '../errors/app_failure.dart';

T unwrapData<T>(Response<dynamic> response) {
  final body = response.data;
  if (body is Map<String, dynamic> && body.containsKey('data')) {
    return body['data'] as T;
  }
  throw const AppFailure(message: 'Respuesta inesperada del servidor.');
}

class Paged<T> {
  const Paged({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<T> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  bool get hasMore => page < totalPages;
  bool get isEmpty => items.isEmpty;
}

Paged<T> unwrapPage<T>(
  Response<dynamic> response,
  T Function(Map<String, dynamic> json) parse,
) {
  final body = response.data;
  if (body is! Map<String, dynamic> || body['data'] is! List<dynamic>) {
    throw const AppFailure(message: 'Respuesta inesperada del servidor.');
  }
  final meta = (body['meta'] as Map<String, dynamic>?) ?? const {};
  final items = [
    for (final row in body['data'] as List<dynamic>)
      parse(row as Map<String, dynamic>),
  ];
  return Paged<T>(
    items: items,
    page: (meta['page'] as int?) ?? 1,
    limit: (meta['limit'] as int?) ?? items.length,
    total: (meta['total'] as int?) ?? items.length,
    totalPages: (meta['totalPages'] as int?) ?? 1,
  );
}

AppFailure mapDioException(DioException error) {
  final response = error.response;
  if (response == null) {
    return networkFailure;
  }
  final body = response.data;
  final code = body is Map<String, dynamic> ? body['code'] as String? : null;
  final details = body is Map<String, dynamic> && body['details'] is Map
      ? Map<String, dynamic>.from(body['details'] as Map)
      : null;
  return failureFromApi(
    statusCode: response.statusCode,
    code: code,
    details: details,
  );
}
