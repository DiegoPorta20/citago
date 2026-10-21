import '../../domain/entities/auth_session.dart';

class TokenPairModel {
  const TokenPairModel({required this.accessToken, required this.refreshToken});

  factory TokenPairModel.fromJson(Map<String, dynamic> json) => TokenPairModel(
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
  );

  final String accessToken;
  final String refreshToken;
}

class SessionModel {
  const SessionModel({
    required this.userId,
    required this.userEmail,
    required this.userName,
    required this.tenantId,
    required this.tenantName,
    required this.currency,
    required this.timezone,
    required this.role,
  });

  factory SessionModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>;
    final tenant = json['tenant'] as Map<String, dynamic>;
    return SessionModel(
      userId: user['id'] as String,
      userEmail: user['email'] as String,
      userName: user['name'] as String,
      tenantId: tenant['id'] as String,
      tenantName: tenant['name'] as String,
      currency: tenant['currency'] as String,
      timezone: tenant['timezone'] as String,
      role: json['role'] as String,
    );
  }

  final String userId;
  final String userEmail;
  final String userName;
  final String tenantId;
  final String tenantName;
  final String currency;
  final String timezone;
  final String role;

  AuthSession toEntity() => AuthSession(
    user: SessionUser(id: userId, email: userEmail, name: userName),
    tenant: SessionTenant(
      id: tenantId,
      name: tenantName,
      currency: currency,
      timezone: timezone,
    ),
    role: UserRole.parse(role),
  );
}

TenantChoice tenantChoiceFromJson(Map<String, dynamic> json) => TenantChoice(
  tenantId: json['tenantId'] as String,
  name: json['tenantName'] as String,
  role: UserRole.parse(json['role'] as String),
  current: json['current'] as bool,
);
