import '../entities/auth_session.dart';
import '../entities/business_registration.dart';

abstract class AuthRepository {
  Future<AuthSession> login({required String email, required String password});

  Future<AuthSession> register(BusinessRegistration registration);

  Future<AuthSession?> restore();

  Future<List<TenantChoice>> tenants();

  Future<void> switchTenant(String tenantId);

  Future<void> logout();
}
