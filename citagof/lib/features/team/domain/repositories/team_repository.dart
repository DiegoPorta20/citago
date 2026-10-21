import '../../../authentication/domain/entities/auth_session.dart';
import '../entities/team_member.dart';

abstract class TeamRepository {
  Future<List<TeamMember>> list();

  Future<AddedTeamMember> add(TeamMemberInput input);

  Future<TeamMember> changeRole(String membershipId, UserRole role);

  Future<TeamMember> revoke(String membershipId);

  Future<TeamMember> restore(String membershipId);
}
