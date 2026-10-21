import '../../../authentication/domain/entities/auth_session.dart';
import '../entities/team_member.dart';

abstract final class TeamPermissions {
  static List<UserRole> assignableRoles(UserRole actor) => switch (actor) {
    UserRole.owner => const [UserRole.staff, UserRole.admin, UserRole.owner],
    UserRole.admin => const [UserRole.staff],
    UserRole.staff => const [],
  };

  static bool canGrant(UserRole actor, UserRole role) =>
      assignableRoles(actor).contains(role);

  static bool canChangeRole(
    UserRole actor,
    String actorUserId,
    TeamMember target,
  ) {
    if (target.userId == actorUserId) return false;
    return switch (actor) {
      UserRole.owner => true,
      UserRole.admin => target.role == UserRole.staff,
      UserRole.staff => false,
    };
  }

  static bool canRevoke(UserRole actor, String actorUserId, TeamMember target) {
    if (target.userId == actorUserId) return false;
    return switch (actor) {
      UserRole.owner => true,
      UserRole.admin => target.role == UserRole.staff,
      UserRole.staff => false,
    };
  }
}
