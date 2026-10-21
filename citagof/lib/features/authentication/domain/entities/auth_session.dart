enum UserRole {
  owner,
  admin,
  staff;

  static UserRole parse(String value) => switch (value) {
    'OWNER' => UserRole.owner,
    'ADMIN' => UserRole.admin,
    'STAFF' => UserRole.staff,
    _ => throw FormatException('Unknown role: $value'),
  };

  bool get managesBusiness => this != UserRole.staff;
}

class SessionUser {
  const SessionUser({
    required this.id,
    required this.email,
    required this.name,
  });

  final String id;
  final String email;
  final String name;
}

class SessionTenant {
  const SessionTenant({
    required this.id,
    required this.name,
    required this.currency,
    required this.timezone,
  });

  final String id;
  final String name;

  final String currency;

  final String timezone;
}

class AuthSession {
  const AuthSession({
    required this.user,
    required this.tenant,
    required this.role,
  });

  final SessionUser user;
  final SessionTenant tenant;
  final UserRole role;
}

class TenantChoice {
  const TenantChoice({
    required this.tenantId,
    required this.name,
    required this.role,
    required this.current,
  });

  final String tenantId;
  final String name;
  final UserRole role;

  final bool current;
}
