import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/initials_avatar.dart';
import '../../../../core/widgets/list_card.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../domain/entities/staff_member.dart';
import '../providers/staff_providers.dart';
import '../staff_routes.dart';

class StaffListPage extends ConsumerWidget {
  const StaffListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final staff = ref.watch(staffListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Profesionales')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(StaffRoutes.create),
        icon: const Icon(Icons.person_add_alt_1_rounded),
        label: const Text('Nuevo'),
      ),
      body: staff.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(staffListProvider),
        ),
        data: (members) => members.isEmpty
            ? const EmptyState(
                icon: Icons.badge_outlined,
                title: 'Aún no hay profesionales.',
                message: 'Agrega el primero con "Nuevo".',
              )
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(staffListProvider),
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
                    child: _StaffTile(member: members[index]),
                  ),
                ),
              ),
      ),
    );
  }
}

class _StaffTile extends StatelessWidget {
  const _StaffTile({required this.member});

  final StaffMember member;

  @override
  Widget build(BuildContext context) {
    return ListCard(
      leading: InitialsAvatar(name: member.displayName),
      title: member.displayName,
      subtitle: Align(
        alignment: Alignment.centerLeft,
        child: StatusBadge(active: member.active),
      ),
      dimmed: !member.active,
      onTap: () => context.push(StaffRoutes.detail(member.id)),
    );
  }
}

/// "Activo" / "Inactivo" pill, shared by the list and the detail page.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) => StatusPill(
    label: active ? 'Activo' : 'Inactivo',
    tone: active ? StatusTone.success : StatusTone.neutral,
  );
}
