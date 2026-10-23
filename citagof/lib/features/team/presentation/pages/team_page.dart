import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/initials_avatar.dart';
import '../../../../core/widgets/list_card.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../authentication/domain/entities/auth_session.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/team_member.dart';
import '../../domain/permissions/team_permissions.dart';
import '../providers/team_providers.dart';
import '../team_routes.dart';
import '../widgets/role_label.dart';

class TeamPage extends ConsumerWidget {
  const TeamPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final team = ref.watch(teamListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Equipo')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(TeamRoutes.create),
        icon: const Icon(Icons.person_add_alt_1_rounded),
        label: const Text('Dar acceso'),
      ),
      body: team.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(teamListProvider),
        ),
        data: (members) => members.isEmpty
            ? const _EmptyState()
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(teamListProvider),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.page,
                    AppSpacing.s,
                    AppSpacing.page,
                    104,
                  ),
                  itemCount: members.length,
                  itemBuilder: (context, index) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.m),
                    child: _MemberTile(member: members[index]),
                  ),
                ),
              ),
      ),
    );
  }
}

class _MemberTile extends ConsumerWidget {
  const _MemberTile({required this.member});

  final TeamMember member;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider).value;
    final actor = session?.role ?? UserRole.staff;
    final actorUserId = session?.user.id ?? '';

    final isSelf = member.userId == actorUserId;
    final canChangeRole = TeamPermissions.canChangeRole(
      actor,
      actorUserId,
      member,
    );
    final canRevoke = TeamPermissions.canRevoke(actor, actorUserId, member);

    final revoked = !member.isActive;

    return ListCard(
      leading: InitialsAvatar(name: member.name),
      title: member.name,
      dimmed: revoked,
      padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListCardSubtitle(member.email),
          const SizedBox(height: AppSpacing.s),
          Wrap(
            spacing: AppSpacing.s,
            runSpacing: AppSpacing.xs,
            children: [
              if (isSelf)
                const StatusPill(
                  label: 'Tú',
                  tone: StatusTone.teal,
                  showDot: false,
                ),
              StatusPill(
                label: roleLabel(member.role),
                tone: switch (member.role) {
                  UserRole.owner => StatusTone.accent,
                  UserRole.admin => StatusTone.info,
                  UserRole.staff => StatusTone.neutral,
                },
                showDot: false,
              ),
              if (revoked)
                const StatusPill(label: 'Revocado', tone: StatusTone.danger)
              else
                const StatusPill(label: 'Activo', tone: StatusTone.success),
            ],
          ),
        ],
      ),
      trailing: (canChangeRole || canRevoke || revoked)
          ? _MemberMenu(
              member: member,
              canChangeRole: canChangeRole,
              canRevoke: canRevoke,
              actor: actor,
            )
          : null,
    );
  }
}

enum _MemberAction { changeRole, revoke, restore }

class _MemberMenu extends ConsumerWidget {
  const _MemberMenu({
    required this.member,
    required this.canChangeRole,
    required this.canRevoke,
    required this.actor,
  });

  final TeamMember member;
  final bool canChangeRole;
  final bool canRevoke;
  final UserRole actor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final revoked = !member.isActive;
    return PopupMenuButton<_MemberAction>(
      tooltip: 'Acciones',
      onSelected: (action) => _onAction(context, ref, action),
      itemBuilder: (context) => [
        if (canChangeRole && !revoked)
          const PopupMenuItem(
            value: _MemberAction.changeRole,
            child: Text('Cambiar rol'),
          ),
        if (canRevoke && !revoked)
          const PopupMenuItem(
            value: _MemberAction.revoke,
            child: Text('Revocar acceso'),
          ),
        if (revoked)
          const PopupMenuItem(
            value: _MemberAction.restore,
            child: Text('Restaurar acceso'),
          ),
      ],
    );
  }

  Future<void> _onAction(
    BuildContext context,
    WidgetRef ref,
    _MemberAction action,
  ) async {
    switch (action) {
      case _MemberAction.changeRole:
        await _changeRole(context, ref);
      case _MemberAction.revoke:
        await _revoke(context, ref);
      case _MemberAction.restore:
        await _run(
          context,
          ref,
          () => ref.read(restoreTeamMemberUseCaseProvider)(member.id),
        );
    }
  }

  Future<void> _changeRole(BuildContext context, WidgetRef ref) async {
    final roles = TeamPermissions.assignableRoles(actor)
        .where((r) => r != member.role)
        .toList();
    if (roles.isEmpty) return;

    final chosen = await showDialog<UserRole>(
      context: context,
      builder: (context) => SimpleDialog(
        title: Text('Cambiar rol de ${member.name}'),
        children: [
          for (final role in roles)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, role),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(roleLabel(role)),
              ),
            ),
        ],
      ),
    );
    if (chosen == null || !context.mounted) return;
    await _run(
      context,
      ref,
      () => ref.read(changeTeamMemberRoleUseCaseProvider)(member.id, chosen),
    );
  }

  Future<void> _revoke(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Revocar acceso?'),
        content: Text(
          '${member.name} dejará de poder entrar al negocio. Sus sesiones '
          'dejan de funcionar enseguida. Puedes restaurar el acceso después.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Revocar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await _run(
      context,
      ref,
      () => ref.read(revokeTeamMemberUseCaseProvider)(member.id),
    );
  }

  Future<void> _run(
    BuildContext context,
    WidgetRef ref,
    Future<TeamMember> Function() action,
  ) async {
    try {
      await action();
    } on Object catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(failureMessage(error))));
      }
      return;
    }
    ref.invalidate(teamListProvider);
    ref.invalidate(teamMembersProvider);
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const EmptyState(
      icon: Icons.groups_outlined,
      title: 'Aún no hay nadie más.',
      message: 'Da acceso con "Dar acceso".',
    );
  }
}
