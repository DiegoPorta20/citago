import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:citagof/core/network/auth_interceptor.dart';
import 'package:citagof/core/storage/token_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

class _MemoryStorage implements TokenStorage {
  _MemoryStorage(this.tokens);

  StoredTokens? tokens;

  @override
  Future<StoredTokens?> read() async => tokens;

  @override
  Future<void> write(StoredTokens value) async => tokens = value;

  @override
  Future<void> clear() async => tokens = null;
}

class _Backend implements HttpClientAdapter {
  final List<String?> seenAuth = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final auth = options.headers['Authorization'] as String?;
    seenAuth.add(auth);
    final ok = auth == 'Bearer fresh';
    return ResponseBody.fromString(
      jsonEncode(
        ok ? {'data': 'ok'} : {'statusCode': 401, 'code': 'UNAUTHORIZED'},
      ),
      ok ? 200 : 401,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late _MemoryStorage storage;
  late _Backend backend;
  late Dio dio;
  late int refreshCalls;
  late int expiredCalls;

  void build(Future<StoredTokens?> Function(String) refresh) {
    refreshCalls = 0;
    expiredCalls = 0;
    backend = _Backend();
    dio = Dio(BaseOptions(baseUrl: 'http://test'))..httpClientAdapter = backend;
    dio.interceptors.add(
      AuthInterceptor(
        dio: dio,
        storage: storage,
        refresh: (token) {
          refreshCalls++;
          return refresh(token);
        },
        onSessionExpired: () => expiredCalls++,
      ),
    );
  }

  setUp(() {
    storage = _MemoryStorage(
      const StoredTokens(accessToken: 'stale', refreshToken: 'r1'),
    );
  });

  test('refreshes once and retries when the access token expired', () async {
    build(
      (_) async => const StoredTokens(accessToken: 'fresh', refreshToken: 'r2'),
    );

    final response = await dio.get<dynamic>('/clients');

    expect(response.statusCode, 200);
    expect(refreshCalls, 1);
    expect(storage.tokens?.refreshToken, 'r2');
  });

  test('concurrent 401s share a single refresh', () async {
    final gate = Completer<StoredTokens?>();
    build((_) => gate.future);

    final calls = Future.wait([
      dio.get<dynamic>('/a'),
      dio.get<dynamic>('/b'),
      dio.get<dynamic>('/c'),
    ]);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    gate.complete(const StoredTokens(accessToken: 'fresh', refreshToken: 'r2'));
    final responses = await calls;

    expect(responses.map((r) => r.statusCode), everyElement(200));
    expect(refreshCalls, 1, reason: 'a rotated token must not be reused');
  });

  test('signs out when the server refuses the refresh token', () async {
    build((_) async => null);

    await expectLater(
      dio.get<dynamic>('/clients'),
      throwsA(isA<DioException>()),
    );

    expect(storage.tokens, isNull);
    expect(expiredCalls, 1);
  });

  test(
    'keeps the session when the refresh fails for network reasons',
    () async {
      build((_) async => throw DioException(requestOptions: RequestOptions()));

      await expectLater(
        dio.get<dynamic>('/clients'),
        throwsA(isA<DioException>()),
      );

      expect(storage.tokens?.refreshToken, 'r1');
      expect(expiredCalls, 0);
    },
  );

  test('does not try to refresh on the login endpoint', () async {
    build(
      (_) async => const StoredTokens(accessToken: 'fresh', refreshToken: 'r2'),
    );

    await expectLater(
      dio.post<dynamic>('/auth/login'),
      throwsA(isA<DioException>()),
    );

    expect(refreshCalls, 0);
    expect(backend.seenAuth.single, isNull);
  });
}
