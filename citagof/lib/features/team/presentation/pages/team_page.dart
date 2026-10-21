import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/widgets/error_view.dart';
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
        icon: const Icon(Icons.person_add_alt_1),
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
                  padding: const EdgeInsets.only(bottom: 96),
                  itemCount: members.length,
                  itemBuilder: (context, index) =>
                      _MemberTile(member: members[index]),
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
    final theme = Theme.of(context);
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

    return ListTile(
      minTileHeight: 72,
      leading: CircleAvatar(
        backgroundColor: revoked
            ? theme.colorScheme.surfaceContainerHighest
            : theme.colorScheme.primaryContainer,
        child: Text(member.initials),
      ),
      title: Row(
        children: [
          Flexible(
            child: Text(
              member.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (isSelf)
            Padding(
              padding: const EdgeInsets.only(left: 6),
              child: Text(
                '(tú)',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
            ),
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(member.email, maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Row(
            children: [
              _Badge(text: roleLabel(member.role)),
              const SizedBox(width: 6),
              if (revoked)
                _Badge(
                  text: 'Revocado',
                  color: theme.colorScheme.errorContainer,
                  textColor: theme.colorScheme.onErrorContainer,
                )
              else
                _Badge(
                  text: 'Activo',
                  color: theme.colorScheme.secondaryContainer,
                  textColor: theme.colorScheme.onSecondaryContainer,
                ),
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

class _Badge extends StatelessWidget {
  const _Badge({required this.text, this.color, this.textColor});

  final String text;
  final Color? color;
  final Color? textColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color ?? theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: theme.textTheme.labelSmall?.copyWith(
          color: textColor ?? theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.groups_outlined,
              size: 56,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 12),
            const Text(
              'Aún no hay nadie más. Da acceso con "Dar acceso".',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
