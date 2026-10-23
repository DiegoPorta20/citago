import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/widgets/initials_avatar.dart';
import '../../../team/domain/entities/team_member.dart';
import '../../../team/presentation/providers/team_providers.dart';
import '../../../team/presentation/widgets/role_label.dart';

class AssigneeChoice {
  const AssigneeChoice(this.userId);

  final String? userId;
}

Future<AssigneeChoice?> pickAssignee(
  BuildContext context, {
  String? currentUserId,
}) {
  return showModalBottomSheet<AssigneeChoice>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _AssigneeSheet(currentUserId: currentUserId),
  );
}

class _AssigneeSheet extends ConsumerWidget {
  const _AssigneeSheet({required this.currentUserId});

  final String? currentUserId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final members = ref.watch(teamMembersProvider);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: members.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(32),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, _) => Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('No se pudo cargar el equipo.'),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => ref.invalidate(teamMembersProvider),
                  child: const Text('Reintentar'),
                ),
              ],
            ),
          ),
          data: (list) => _List(list: list, currentUserId: currentUserId),
        ),
      ),
    );
  }
}

class _List extends StatelessWidget {
  const _List({required this.list, required this.currentUserId});

  final List<TeamMember> list;
  final String? currentUserId;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Asignar conversación',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ),
        Flexible(
          child: ListView(
            shrinkWrap: true,
            children: [
              ListTile(
                minTileHeight: 56,
                leading: const Icon(Icons.person_off_outlined),
                title: const Text('Sin asignar'),
                selected: currentUserId == null,
                onTap: () => Navigator.pop(context, const AssigneeChoice(null)),
              ),
              if (list.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('No hay miembros activos.'),
                ),
              for (final member in list)
                ListTile(
                  minTileHeight: 56,
                  leading: InitialsAvatar(name: member.name, radius: 20),
                  title: Text(member.name),
                  subtitle: Text(roleLabel(member.role)),
                  selected: currentUserId == member.userId,
                  trailing: currentUserId == member.userId
                      ? const Icon(Icons.check_circle_rounded)
                      : null,
                  onTap: () =>
                      Navigator.pop(context, AssigneeChoice(member.userId)),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
