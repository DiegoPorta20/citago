import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/widgets/error_view.dart';
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
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('Nuevo'),
      ),
      body: staff.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(staffListProvider),
        ),
        data: (members) => members.isEmpty
            ? const _EmptyState()
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(staffListProvider),
                child: ListView.builder(
                  padding: const EdgeInsets.only(bottom: 96),
                  itemCount: members.length,
                  itemBuilder: (context, index) =>
                      _StaffTile(member: members[index]),
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
    return ListTile(
      minTileHeight: 64,
      leading: CircleAvatar(child: Text(_initials(member.displayName))),
      title: Text(member.displayName),
      subtitle: StatusBadge(active: member.active),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => context.push(StaffRoutes.detail(member.id)),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = active ? scheme.primary : scheme.outline;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(top: 4),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          active ? 'Activo' : 'Inactivo',
          style: TextStyle(color: color, fontWeight: FontWeight.w600),
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
              Icons.badge_outlined,
              size: 56,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 12),
            const Text(
              'Aún no hay profesionales. Agrega el primero con "Nuevo".',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
