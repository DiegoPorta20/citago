import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/initials_avatar.dart';
import '../../../../core/widgets/status_pill.dart';
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
                  ? _EmptyInbox(filter: state.filter)
                  : RefreshIndicator(
                      onRefresh: () =>
                          ref.read(inboxProvider.notifier).refresh(),
                      child: ListView.builder(
                        controller: _scroll,
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.only(
                          top: AppSpacing.xs,
                          bottom: AppSpacing.xxxl,
                        ),
                        itemCount: state.items.length + 1,
                        itemBuilder: (context, index) {
                          if (index == state.items.length) {
                            return _Footer(state: state);
                          }
                          return Padding(
                            padding: const EdgeInsets.fromLTRB(
                              AppSpacing.page,
                              0,
                              AppSpacing.page,
                              AppSpacing.m,
                            ),
                            child: _ConversationTile(
                              conversation: state.items[index],
                            ),
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

    return SizedBox(
      height: 52,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.page,
          vertical: AppSpacing.xs,
        ),
        children: [
          ChoiceChip(
            label: const Text('Pendientes'),
            selected: selected == InboxFilter.pending,
            onSelected: (_) => select(InboxFilter.pending),
          ),
          const SizedBox(width: AppSpacing.s),
          ChoiceChip(
            label: const Text('Todas'),
            selected: selected == InboxFilter.all,
            onSelected: (_) => select(InboxFilter.all),
          ),
          if (canManage) ...[
            const SizedBox(width: AppSpacing.s),
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

class _ConversationTile extends ConsumerWidget {
  const _ConversationTile({required this.conversation});

  final Conversation conversation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final clock = ref.watch(businessClockProvider);
    final needsReply = conversation.needsReply;
    final preview = conversation.lastMessagePreview;
    final weight = needsReply ? FontWeight.w700 : FontWeight.w500;
    final hasMeta =
        conversation.isUnlinked || conversation.assignedUserName != null;

    void open() => context.push(ConversationRoutes.detail(conversation.id));

    return Semantics(
      label: needsReply
          ? '${conversation.displayName}, pendiente de respuesta'
          : conversation.displayName,
      button: true,
      onTap: open,
      excludeSemantics: true,
      child: AppCard(
        padding: const EdgeInsets.all(14),
        color: needsReply
            ? scheme.primaryContainer.withValues(alpha: 0.28)
            : null,
        borderColor: needsReply ? scheme.primary.withValues(alpha: 0.35) : null,
        onTap: open,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InitialsAvatar(name: conversation.displayName, radius: 22),
            const SizedBox(width: AppSpacing.m),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          conversation.displayName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: weight,
                          ),
                        ),
                      ),
                      if (conversation.lastMessageAt != null) ...[
                        const SizedBox(width: AppSpacing.s),
                        Text(
                          inboxTimeLabel(conversation.lastMessageAt!, clock),
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: needsReply
                                ? scheme.primary
                                : scheme.onSurfaceVariant,
                            fontWeight: needsReply
                                ? FontWeight.w700
                                : FontWeight.w500,
                            fontFeatures: AppText.tabular,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          (preview == null || preview.isEmpty)
                              ? 'Sin mensajes'
                              : preview,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: needsReply
                                ? FontWeight.w600
                                : FontWeight.w400,
                            color: needsReply
                                ? scheme.onSurface
                                : scheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                      if (needsReply) ...[
                        const SizedBox(width: AppSpacing.s),
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: scheme.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (hasMeta) ...[
                    const SizedBox(height: AppSpacing.s),
                    Wrap(
                      spacing: AppSpacing.s,
                      runSpacing: AppSpacing.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (conversation.isUnlinked)
                          const StatusPill(
                            label: 'Sin vincular',
                            tone: StatusTone.neutral,
                            showDot: false,
                          ),
                        if (conversation.assignedUserName != null)
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.assignment_ind_outlined,
                                size: 14,
                                color: scheme.onSurfaceVariant,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                conversation.assignedUserName!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
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
        padding: EdgeInsets.all(AppSpacing.l),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (state.loadMoreFailed) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.s),
        child: TextButton.icon(
          onPressed: () => ref.read(inboxProvider.notifier).loadMore(),
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('No se pudo cargar más. Reintentar'),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

class _EmptyInbox extends StatelessWidget {
  const _EmptyInbox({required this.filter});

  final InboxFilter filter;

  @override
  Widget build(BuildContext context) {
    final message = switch (filter) {
      InboxFilter.pending => 'No hay conversaciones pendientes. ¡Todo al día!',
      InboxFilter.all => 'Aún no hay conversaciones.',
      InboxFilter.archived => 'No hay conversaciones archivadas.',
    };
    return EmptyState(
      icon: filter == InboxFilter.pending
          ? Icons.mark_chat_read_outlined
          : Icons.forum_outlined,
      title: message,
    );
  }
}
