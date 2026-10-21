import '../../../../core/errors/app_failure.dart';
import '../../../../core/storage/token_storage.dart';
import '../../domain/entities/auth_session.dart';
import '../../domain/entities/business_registration.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';
import '../models/session_model.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl(this._remote, this._storage);

  final AuthRemoteDataSource _remote;
  final TokenStorage _storage;

  @override
  Future<AuthSession> login({
    required String email,
    required String password,
  }) async =>
      _startSession(await _remote.login(email: email, password: password));

  @override
  Future<AuthSession> register(BusinessRegistration registration) async =>
      _startSession(await _remote.register(registration));

  Future<AuthSession> _startSession(TokenPairModel tokens) async {
    await _storage.write(
      StoredTokens(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      ),
    );
    try {
      return (await _remote.me()).toEntity();
    } on Object {
      await _storage.clear();
      rethrow;
    }
  }

  @override
  Future<AuthSession?> restore() async {
    if (await _storage.read() == null) return null;
    try {
      return (await _remote.me()).toEntity();
    } on AppFailure catch (failure) {
      if (failure.isUnauthorized) {
        await _storage.clear();
        return null;
      }
      rethrow;
    }
  }

  @override
  Future<List<TenantChoice>> tenants() => _remote.tenants();

  @override
  Future<void> switchTenant(String tenantId) async {
    final current = await _storage.read();
    if (current == null) {
      throw const AppFailure(
        message: 'Tu sesión expiró. Inicia sesión de nuevo.',
      );
    }
    final next = await _remote.switchTenant(
      tenantId: tenantId,
      refreshToken: current.refreshToken,
    );
    await _storage.write(
      StoredTokens(
        accessToken: next.accessToken,
        refreshToken: next.refreshToken,
      ),
    );
  }

  @override
  Future<void> logout() async {
    final tokens = await _storage.read();
    await _storage.clear();
    if (tokens != null) {
      await _remote.logout(tokens.refreshToken);
    }
  }
}
