import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/widgets/error_view.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/conversation.dart';
import '../../domain/repositories/conversation_repository.dart';
import '../conversations_routes.dart';
import '../providers/conversation_providers.dart';
import '../widgets/conversation_time.dart';

class InboxPage extends ConsumerStatefulWidget {
  const InboxPage({super.key});

  @override
  ConsumerState<InboxPage> createState() => _InboxPageState();
}

class _InboxPageState extends ConsumerState<InboxPage> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 300) {
        ref.read(inboxProvider.notifier).loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final inbox = ref.watch(inboxProvider);
    final filter = ref.watch(inboxFilterProvider);
    final canManage =
        ref.watch(sessionControllerProvider).value?.role.managesBusiness ??
        false;

    return Scaffold(
      appBar: AppBar(title: const Text('Conversaciones')),
      body: Column(
        children: [
          _FilterChips(selected: filter, canManage: canManage),
          if (inbox.value?.refreshing ?? false)
            const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: inbox.when(
              skipLoadingOnReload: true,
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => ErrorView(
                error: error,
                onRetry: () => ref.read(inboxProvider.notifier).refresh(),
              ),
              data: (state) => state.items.isEmpty
                  ? _EmptyState(filter: state.filter)
                  : RefreshIndicator(
                      onRefresh: () =>
                          ref.read(inboxProvider.notifier).refresh(),
                      child: ListView.builder(
                        controller: _scroll,
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.only(bottom: 24),
                        itemCount: state.items.length + 1,
                        itemBuilder: (context, index) {
                          if (index == state.items.length) {
                            return _Footer(state: state);
                          }
                          return _ConversationTile(
                            conversation: state.items[index],
                          );
                        },
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChips extends ConsumerWidget {
  const _FilterChips({required this.selected, required this.canManage});

  final InboxFilter selected;
  final bool canManage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    void select(InboxFilter filter) =>
        ref.read(inboxFilterProvider.notifier).select(filter);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          ChoiceChip(
            label: const Text('Pendientes'),
            selected: selected == InboxFilter.pending,
            onSelected: (_) => select(InboxFilter.pending),
          ),
          const SizedBox(width: 8),
          ChoiceChip(
            label: const Text('Todas'),
            selected: selected == InboxFilter.all,
            onSelected: (_) => select(InboxFilter.all),
          ),
          if (canManage) ...[
            const SizedBox(width: 8),
            ChoiceChip(
              label: const Text('Archivadas'),
              selected: selected == InboxFilter.archived,
              onSelected: (_) => select(InboxFilter.archived),
            ),
          ],
        ],
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.conversation});

  final Conversation conversation;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final needsReply = conversation.needsReply;
    final preview = conversation.lastMessagePreview;
    final weight = needsReply ? FontWeight.w700 : FontWeight.w400;

    return Semantics(
      label: needsReply
          ? '${conversation.displayName}, pendiente de respuesta'
          : conversation.displayName,
      button: true,
      child: ListTile(
        minTileHeight: 72,
        leading: _Dot(active: needsReply),
        title: Row(
          children: [
            Expanded(
              child: Text(
                conversation.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontWeight: weight),
              ),
            ),
            if (conversation.lastMessageAt != null)
              Padding(
                padding: const EdgeInsets.only(left: 8),
                child: Builder(
                  builder: (context) => _TimeLabel(
                    instant: conversation.lastMessageAt!,
                    emphasized: needsReply,
                  ),
                ),
              ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              (preview == null || preview.isEmpty) ? 'Sin mensajes' : preview,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontWeight: weight),
            ),
            if (conversation.isUnlinked)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  'Sin vincular',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                ),
              ),
            if (conversation.assignedUserName != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  children: [
                    Icon(
                      Icons.assignment_ind_outlined,
                      size: 13,
                      color: theme.colorScheme.outline,
                    ),
                    const SizedBox(width: 2),
                    Flexible(
                      child: Text(
                        conversation.assignedUserName!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.outline,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        onTap: () => context.push(ConversationRoutes.detail(conversation.id)),
      ),
    );
  }
}

class _TimeLabel extends ConsumerWidget {
  const _TimeLabel({required this.instant, required this.emphasized});

  final DateTime instant;
  final bool emphasized;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final clock = ref.watch(businessClockProvider);
    return Text(
      inboxTimeLabel(instant, clock),
      style: theme.textTheme.labelSmall?.copyWith(
        color: emphasized
            ? theme.colorScheme.primary
            : theme.colorScheme.outline,
        fontWeight: emphasized ? FontWeight.w700 : FontWeight.w400,
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    final color = active
        ? Theme.of(context).colorScheme.primary
        : Colors.transparent;
    return SizedBox(
      width: 12,
      child: Center(
        child: Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
      ),
    );
  }
}

class _Footer extends ConsumerWidget {
  const _Footer({required this.state});

  final InboxState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.loadingMore) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (state.loadMoreFailed) {
      return Padding(
        padding: const EdgeInsets.all(8),
        child: TextButton.icon(
          onPressed: () => ref.read(inboxProvider.notifier).loadMore(),
          icon: const Icon(Icons.refresh),
          label: const Text('No se pudo cargar más. Reintentar'),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.filter});

  final InboxFilter filter;

  @override
  Widget build(BuildContext context) {
    final message = switch (filter) {
      InboxFilter.pending => 'No hay conversaciones pendientes. ¡Todo al día!',
      InboxFilter.all => 'Aún no hay conversaciones.',
      InboxFilter.archived => 'No hay conversaciones archivadas.',
    };
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.forum_outlined,
              size: 56,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
