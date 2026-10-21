import '../../../authentication/domain/entities/auth_session.dart';
import '../entities/team_member.dart';
import '../repositories/team_repository.dart';

class ListTeamMembersUseCase {
  const ListTeamMembersUseCase(this._repository);

  final TeamRepository _repository;

  Future<List<TeamMember>> call() => _repository.list();
}

class AddTeamMemberUseCase {
  const AddTeamMemberUseCase(this._repository);

  final TeamRepository _repository;

  Future<AddedTeamMember> call(TeamMemberInput input) => _repository.add(input);
}

class ChangeTeamMemberRoleUseCase {
  const ChangeTeamMemberRoleUseCase(this._repository);

  final TeamRepository _repository;

  Future<TeamMember> call(String membershipId, UserRole role) =>
      _repository.changeRole(membershipId, role);
}

class RevokeTeamMemberUseCase {
  const RevokeTeamMemberUseCase(this._repository);

  final TeamRepository _repository;

  Future<TeamMember> call(String membershipId) =>
      _repository.revoke(membershipId);
}

class RestoreTeamMemberUseCase {
  const RestoreTeamMemberUseCase(this._repository);

  final TeamRepository _repository;

  Future<TeamMember> call(String membershipId) =>
      _repository.restore(membershipId);
}
