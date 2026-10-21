import '../entities/auth_session.dart';
import '../entities/business_registration.dart';
import '../repositories/auth_repository.dart';

class LoginUseCase {
  const LoginUseCase(this._repository);

  final AuthRepository _repository;

  Future<AuthSession> call({required String email, required String password}) =>
      _repository.login(email: email.trim(), password: password);
}

class RestoreSessionUseCase {
  const RestoreSessionUseCase(this._repository);

  final AuthRepository _repository;

  Future<AuthSession?> call() => _repository.restore();
}

class LogoutUseCase {
  const LogoutUseCase(this._repository);

  final AuthRepository _repository;

  Future<void> call() => _repository.logout();
}

class RegisterBusinessUseCase {
  const RegisterBusinessUseCase(this._repository);

  final AuthRepository _repository;

  Future<AuthSession> call(BusinessRegistration registration) =>
      _repository.register(registration);
}

class ListTenantsUseCase {
  const ListTenantsUseCase(this._repository);

  final AuthRepository _repository;

  Future<List<TenantChoice>> call() => _repository.tenants();
}

class SwitchTenantUseCase {
  const SwitchTenantUseCase(this._repository);

  final AuthRepository _repository;

  Future<void> call(String tenantId) => _repository.switchTenant(tenantId);
}
