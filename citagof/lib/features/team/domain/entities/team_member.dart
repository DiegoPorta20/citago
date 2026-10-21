import '../../../authentication/domain/entities/auth_session.dart';

enum MembershipStatus {
  active,
  revoked;

  static MembershipStatus parse(String value) => switch (value) {
    'ACTIVE' => MembershipStatus.active,
    'REVOKED' => MembershipStatus.revoked,
    _ => MembershipStatus.active,
  };

  bool get isActive => this == MembershipStatus.active;
}

class TeamMember {
  const TeamMember({
    required this.id,
    required this.userId,
    required this.name,
    required this.email,
    required this.role,
    required this.status,
  });

  final String id;

  final String userId;

  final String name;
  final String email;
  final UserRole role;
  final MembershipStatus status;

  bool get isActive => status.isActive;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return '?';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}

class AddedTeamMember {
  const AddedTeamMember({required this.member, this.temporaryPassword});

  final TeamMember member;

  final String? temporaryPassword;
}

class TeamMemberInput {
  const TeamMemberInput({
    required this.name,
    required this.email,
    required this.role,
  });

  final String name;
  final String email;
  final UserRole role;
}
