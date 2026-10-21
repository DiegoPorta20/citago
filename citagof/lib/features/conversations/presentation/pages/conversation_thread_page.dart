import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../../clients/presentation/clients_routes.dart';
import '../../../clients/presentation/pages/client_picker_page.dart';
import '../../../team/presentation/providers/team_providers.dart';
import '../../domain/entities/conversation.dart';
import '../../domain/entities/message.dart';
import '../providers/conversation_providers.dart';
import '../providers/reply_controller.dart';
import '../widgets/assignee_picker.dart';
import '../widgets/message_bubble.dart';
import '../widgets/reply_composer.dart';

enum _ThreadAction { resolve, link, unlink, archive, reopen, assign, unassign }

class ConversationThreadPage extends ConsumerStatefulWidget {
  const ConversationThreadPage({super.key, required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<ConversationThreadPage> createState() =>
      _ConversationThreadPageState();
}

class _ConversationThreadPageState
    extends ConsumerState<ConversationThreadPage> {
  final _composer = TextEditingController();
  final _scroll = ScrollController();

  bool _windowClosedByServer = false;

  String get _id => widget.conversationId;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels <= 80) {
        ref.read(threadProvider(_id).notifier).loadOlder();
      }
    });
  }

  @override
  void dispose() {
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final conversation = ref.watch(conversationProvider(_id));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          conversation.value?.displayName ?? 'Conversación',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          if (conversation.hasValue)
            _ActionsMenu(
              conversation: conversation.requireValue,
              onSelected: _onAction,
            ),
        ],
      ),
      body: conversation.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(conversationProvider(_id)),
        ),
        data: (data) => _Loaded(
          conversation: data,
          scroll: _scroll,
          composer: _composer,
          windowClosedByServer: _windowClosedByServer,
          onSend: () => _send(data),
          onLinkPrompt: () => _onAction(data, _ThreadAction.link),
        ),
      ),
    );
  }

  Future<void> _send(Conversation conversation) async {
    final text = _composer.text.trim();
    if (text.isEmpty) return;

    final result = await ref
        .read(replyControllerProvider(_id).notifier)
        .send(text);
    if (!mounted) return;

    switch (result) {
      case ReplySent(:final message):
        _composer.clear();
        ref.read(threadProvider(_id).notifier).appendSent(message);
        ref.invalidate(conversationProvider(_id));
        ref.invalidate(inboxProvider);
        _scrollToBottomSoon();
      case ReplyFailed(:final failure):
        if (result.windowClosed) {
          setState(() => _windowClosedByServer = true);
        }
        _notify(failure.message);
    }
  }

  Future<void> _onAction(
    Conversation conversation,
    _ThreadAction action,
  ) async {
    switch (action) {
      case _ThreadAction.resolve:
        await _run(() => ref.read(resolveConversationUseCaseProvider)(_id));
      case _ThreadAction.archive:
        await _run(() => ref.read(archiveConversationUseCaseProvider)(_id));
      case _ThreadAction.reopen:
        await _run(() => ref.read(reopenConversationUseCaseProvider)(_id));
      case _ThreadAction.unlink:
        await _run(
          () => ref.read(linkConversationClientUseCaseProvider)(_id, null),
        );
      case _ThreadAction.link:
        final client = await pickClient(context);
        if (client == null || !mounted) return;
        await _run(
          () => ref.read(linkConversationClientUseCaseProvider)(_id, client.id),
        );
      case _ThreadAction.assign:
        final choice = await pickAssignee(
          context,
          currentUserId: conversation.assignedUserId,
        );
        if (choice == null || !mounted) return;
        await _run(
          () => ref.read(assignConversationUseCaseProvider)(_id, choice.userId),
        );
      case _ThreadAction.unassign:
        await _run(
          () => ref.read(assignConversationUseCaseProvider)(_id, null),
        );
    }
  }

  Future<void> _run(Future<Conversation> Function() action) async {
    try {
      await action();
    } on Object catch (error) {
      if (mounted) _notify(failureMessage(error));
      return;
    }
    if (!mounted) return;
    ref.invalidate(conversationProvider(_id));
    ref.invalidate(inboxProvider);
  }

  void _scrollToBottomSoon() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  void _notify(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}

class _ActionsMenu extends StatelessWidget {
  const _ActionsMenu({required this.conversation, required this.onSelected});

  final Conversation conversation;
  final void Function(Conversation, _ThreadAction) onSelected;

  @override
  Widget build(BuildContext context) {
    final archived = conversation.status.isArchived;
    return Consumer(
      builder: (context, ref, _) {
        final canManage =
            ref.watch(sessionControllerProvider).value?.role.managesBusiness ??
            false;
        return PopupMenuButton<_ThreadAction>(
          tooltip: 'Acciones',
          onSelected: (action) => onSelected(conversation, action),
          itemBuilder: (context) => [
            if (conversation.needsReply)
              const PopupMenuItem(
                value: _ThreadAction.resolve,
                child: Text('Marcar resuelta'),
              ),
            PopupMenuItem(
              value: _ThreadAction.link,
              child: Text(
                conversation.isUnlinked
                    ? 'Vincular cliente'
                    : 'Cambiar cliente',
              ),
            ),
            if (!conversation.isUnlinked)
              const PopupMenuItem(
                value: _ThreadAction.unlink,
                child: Text('Desvincular cliente'),
              ),
            if (canManage)
              PopupMenuItem(
                value: _ThreadAction.assign,
                child: Text(
                  conversation.assignedUserId == null ? 'Asignar' : 'Reasignar',
                ),
              ),
            if (canManage && conversation.assignedUserId != null)
              const PopupMenuItem(
                value: _ThreadAction.unassign,
                child: Text('Quitar asignación'),
              ),
            if (canManage && !archived)
              const PopupMenuItem(
                value: _ThreadAction.archive,
                child: Text('Archivar'),
              ),
            if (canManage && archived)
              const PopupMenuItem(
                value: _ThreadAction.reopen,
                child: Text('Reabrir'),
              ),
          ],
        );
      },
    );
  }
}

class _Loaded extends ConsumerWidget {
  const _Loaded({
    required this.conversation,
    required this.scroll,
    required this.composer,
    required this.windowClosedByServer,
    required this.onSend,
    required this.onLinkPrompt,
  });

  final Conversation conversation;
  final ScrollController scroll;
  final TextEditingController composer;
  final bool windowClosedByServer;
  final VoidCallback onSend;
  final VoidCallback onLinkPrompt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final thread = ref.watch(threadProvider(conversation.id));
    final sending = ref
        .watch(replyControllerProvider(conversation.id))
        .isLoading;
    final now = ref.watch(nowProvider)().toUtc();

    final lastInbound = thread.value?.lastInboundAt;
    final windowOpen =
        !windowClosedByServer &&
        replyWindowOpen(lastInboundAt: lastInbound, now: now);

    return Column(
      children: [
        _ClientBanner(conversation: conversation, onLink: onLinkPrompt),
        if (conversation.assignedUserId != null)
          _AssigneeBanner(conversation: conversation),
        Expanded(
          child: thread.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => ErrorView(
              error: error,
              onRetry: () =>
                  ref.read(threadProvider(conversation.id).notifier).refresh(),
            ),
            data: (state) => _MessageList(
              conversationId: conversation.id,
              state: state,
              scroll: scroll,
            ),
          ),
        ),
        ReplyComposer(
          controller: composer,
          enabled: windowOpen,
          sending: sending,
          onSend: onSend,
        ),
      ],
    );
  }
}

class _ClientBanner extends StatelessWidget {
  const _ClientBanner({required this.conversation, required this.onLink});

  final Conversation conversation;
  final VoidCallback onLink;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final client = conversation.client;

    if (client == null) {
      return Material(
        color: theme.colorScheme.surfaceContainerHighest,
        child: ListTile(
          minTileHeight: 56,
          leading: const Icon(Icons.person_off_outlined),
          title: Text(conversation.contactIdentifier),
          subtitle: const Text('Sin vincular'),
          trailing: TextButton(
            onPressed: onLink,
            child: const Text('Vincular'),
          ),
        ),
      );
    }

    return Material(
      color: theme.colorScheme.surfaceContainerHighest,
      child: ListTile(
        minTileHeight: 56,
        leading: const Icon(Icons.person_outline),
        title: Text(client.name),
        subtitle: Text(conversation.contactIdentifier),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push(ClientRoutes.detail(client.id)),
      ),
    );
  }
}

class _AssigneeBanner extends ConsumerWidget {
  const _AssigneeBanner({required this.conversation});

  final Conversation conversation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final fromDto = conversation.assignedUserName;
    final resolved = fromDto ?? _resolveName(ref, conversation.assignedUserId);

    return Material(
      color: theme.colorScheme.surfaceContainerHigh,
      child: ListTile(
        minTileHeight: 48,
        dense: true,
        leading: const Icon(Icons.assignment_ind_outlined, size: 20),
        title: Text(
          resolved == null ? 'Asignada' : 'Asignada a $resolved',
          style: theme.textTheme.bodyMedium,
        ),
      ),
    );
  }

  String? _resolveName(WidgetRef ref, String? userId) {
    if (userId == null) return null;
    final members = ref.watch(teamMembersProvider).value;
    if (members == null) return null;
    for (final member in members) {
      if (member.userId == userId) return member.name;
    }
    return null;
  }
}

class _MessageList extends ConsumerWidget {
  const _MessageList({
    required this.conversationId,
    required this.state,
    required this.scroll,
  });

  final String conversationId;
  final ThreadState state;
  final ScrollController scroll;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.messages.isEmpty) {
      return const Center(child: Text('Aún no hay mensajes.'));
    }

    final messages = state.messages;
    return ListView.builder(
      controller: scroll,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: messages.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return _OlderHeader(conversationId: conversationId, state: state);
        }
        return MessageBubble(message: messages[index - 1]);
      },
    );
  }
}

class _OlderHeader extends ConsumerWidget {
  const _OlderHeader({required this.conversationId, required this.state});

  final String conversationId;
  final ThreadState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.loadingMore) {
      return const Padding(
        padding: EdgeInsets.all(12),
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }
    if (state.loadMoreFailed) {
      return Padding(
        padding: const EdgeInsets.all(8),
        child: Center(
          child: TextButton.icon(
            onPressed: () =>
                ref.read(threadProvider(conversationId).notifier).loadOlder(),
            icon: const Icon(Icons.refresh),
            label: const Text('No se pudieron cargar mensajes anteriores'),
          ),
        ),
      );
    }
    return const SizedBox(height: 4);
  }
}
