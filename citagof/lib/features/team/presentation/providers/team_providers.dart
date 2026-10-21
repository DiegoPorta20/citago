import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/providers.dart';
import '../../data/repositories/team_repository_impl.dart';
import '../../domain/entities/team_member.dart';
import '../../domain/repositories/team_repository.dart';
import '../../domain/usecases/team_usecases.dart';

final teamRepositoryProvider = Provider<TeamRepository>(
  (ref) => TeamRepositoryImpl(ref.watch(dioProvider)),
);

final listTeamMembersUseCaseProvider = Provider(
  (ref) => ListTeamMembersUseCase(ref.watch(teamRepositoryProvider)),
);
final addTeamMemberUseCaseProvider = Provider(
  (ref) => AddTeamMemberUseCase(ref.watch(teamRepositoryProvider)),
);
final changeTeamMemberRoleUseCaseProvider = Provider(
  (ref) => ChangeTeamMemberRoleUseCase(ref.watch(teamRepositoryProvider)),
);
final revokeTeamMemberUseCaseProvider = Provider(
  (ref) => RevokeTeamMemberUseCase(ref.watch(teamRepositoryProvider)),
);
final restoreTeamMemberUseCaseProvider = Provider(
  (ref) => RestoreTeamMemberUseCase(ref.watch(teamRepositoryProvider)),
);

final teamListProvider = FutureProvider.autoDispose<List<TeamMember>>(
  (ref) => ref.watch(listTeamMembersUseCaseProvider)(),
);

final teamMembersProvider = FutureProvider.autoDispose<List<TeamMember>>((
  ref,
) async {
  final members = await ref.watch(listTeamMembersUseCaseProvider)();
  return members.where((m) => m.isActive).toList();
});
