import '../../../authentication/domain/entities/auth_session.dart';
import '../../domain/entities/team_member.dart';

String roleToApi(UserRole role) => switch (role) {
  UserRole.owner => 'OWNER',
  UserRole.admin => 'ADMIN',
  UserRole.staff => 'STAFF',
};

TeamMember teamMemberFromJson(Map<String, dynamic> json) => TeamMember(
  id: json['id'] as String,
  userId: json['userId'] as String,
  name: json['name'] as String,
  email: json['email'] as String,
  role: UserRole.parse(json['role'] as String),
  status: MembershipStatus.parse(json['status'] as String),
);

AddedTeamMember addedTeamMemberFromJson(Map<String, dynamic> json) =>
    AddedTeamMember(
      member: teamMemberFromJson(json),
      temporaryPassword: json['temporaryPassword'] as String?,
    );

Map<String, dynamic> addTeamMemberBody(TeamMemberInput input) => {
  'name': input.name.trim(),
  'email': input.email.trim(),
  'role': roleToApi(input.role),
};

Map<String, dynamic> changeRoleBody(UserRole role) => {'role': roleToApi(role)};
