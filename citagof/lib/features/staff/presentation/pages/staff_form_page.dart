import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/widgets/error_banner.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../team/domain/entities/team_member.dart';
import '../../../team/presentation/providers/team_providers.dart';
import '../../domain/entities/staff_member.dart';
import '../providers/staff_providers.dart';
import '../staff_routes.dart';

class StaffFormPage extends ConsumerWidget {
  const StaffFormPage({super.key, this.staffId});

  final String? staffId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = staffId;
    if (id == null) {
      return const _StaffForm();
    }
    final member = ref.watch(staffDetailProvider(id));
    return member.when(
      loading: () => Scaffold(
        appBar: AppBar(title: const Text('Editar profesional')),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('Editar profesional')),
        body: ErrorView(
          error: error,
          onRetry: () => ref.invalidate(staffDetailProvider(id)),
        ),
      ),
      data: (data) => _StaffForm(existing: data),
    );
  }
}

class _StaffForm extends ConsumerStatefulWidget {
  const _StaffForm({this.existing});

  final StaffMember? existing;

  @override
  ConsumerState<_StaffForm> createState() => _StaffFormState();
}

class _StaffFormState extends ConsumerState<_StaffForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.displayName);

  /// `null` means "no linked account". Starts from the member being edited.
  late String? _linkedUserId = widget.existing?.userId;

  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.existing != null;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    final input = StaffMemberInput(
      displayName: _name.text,
      userId: _linkedUserId ?? '',
    );

    try {
      final saved = _isEdit
          ? await ref.read(updateStaffUseCaseProvider)(
              widget.existing!.id,
              input,
            )
          : await ref.read(createStaffUseCaseProvider)(input);
      invalidateStaffFrom(ref, id: saved.id);
      if (!mounted) return;
      if (_isEdit) {
        context.pop();
      } else {
        context.pushReplacement(StaffRoutes.detail(saved.id));
      }
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failureMessage(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Editar profesional' : 'Nuevo profesional'),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.page,
              AppSpacing.s,
              AppSpacing.page,
              AppSpacing.xxxl,
            ),
            children: [
              TextFormField(
                controller: _name,
                enabled: !_saving,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.done,
                maxLength: 120,
                decoration: const InputDecoration(
                  labelText: 'Nombre para mostrar',
                ),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? 'Escribe el nombre'
                    : null,
                onFieldSubmitted: (_) => _save(),
              ),
              const SizedBox(height: AppSpacing.l),
              _AccountLink(
                selectedUserId: _linkedUserId,
                currentStaffId: widget.existing?.id,
                enabled: !_saving,
                onChanged: (userId) => setState(() => _linkedUserId = userId),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                ErrorBanner(_error!),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      )
                    : const Text('Guardar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Picks which team account (if any) this professional signs in with. A
/// professional with no account is just an agenda resource; one with an account
/// sees their own agenda and sales when that person logs in.
class _AccountLink extends ConsumerWidget {
  const _AccountLink({
    required this.selectedUserId,
    required this.currentStaffId,
    required this.enabled,
    required this.onChanged,
  });

  final String? selectedUserId;

  /// The staff member being edited, so its own account is not treated as
  /// "taken by someone else". Null while creating.
  final String? currentStaffId;

  final bool enabled;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final team = ref.watch(teamMembersProvider);
    final staff = ref.watch(staffListProvider);

    Widget frame(Widget child, {String? helper}) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Cuenta de usuario', style: theme.textTheme.titleSmall),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Vincula a este profesional con la cuenta con la que entra a la app. '
          'Déjalo vacío si no usa la app.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: AppSpacing.s),
        child,
        if (helper != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            helper,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );

    if (team.isLoading || staff.isLoading) {
      return frame(
        const SizedBox(
          height: 48,
          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
    }

    final members = team.value;
    if (members == null) {
      return frame(
        OutlinedButton.icon(
          onPressed: () => ref.invalidate(teamMembersProvider),
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('No se pudo cargar el equipo. Reintentar'),
        ),
      );
    }

    // Accounts already linked to a different professional cannot be reused.
    final takenUserIds = {
      for (final member in staff.value ?? const <StaffMember>[])
        if (member.id != currentStaffId && member.userId != null)
          member.userId!,
    };
    final available = [
      for (final member in members)
        if (!takenUserIds.contains(member.userId)) member,
    ];

    // The currently linked account might not be in `available` (e.g. it was
    // revoked from the team). Keep showing it so the owner can see and unlink it.
    final selectedMember = selectedUserId == null
        ? null
        : members.where((m) => m.userId == selectedUserId).firstOrNull;

    if (available.isEmpty && selectedMember == null) {
      return frame(
        OutlinedButton.icon(
          onPressed: null,
          icon: const Icon(Icons.person_add_alt_outlined),
          label: const Text('No hay cuentas disponibles'),
        ),
        helper:
            'Primero da acceso a la persona en Equipo y accesos; luego aparecerá '
            'aquí para vincularla.',
      );
    }

    final items = <DropdownMenuItem<String?>>[
      const DropdownMenuItem(value: null, child: Text('Sin cuenta')),
      for (final member in available)
        DropdownMenuItem(
          value: member.userId,
          child: _MemberLabel(member: member),
        ),
      // A linked-but-revoked account: still selectable so it can be removed.
      if (selectedMember != null &&
          !available.any((m) => m.userId == selectedMember.userId))
        DropdownMenuItem(
          value: selectedMember.userId,
          child: _MemberLabel(member: selectedMember),
        ),
    ];

    return frame(
      DropdownButtonFormField<String?>(
        initialValue: selectedUserId,
        isExpanded: true,
        decoration: const InputDecoration(
          prefixIcon: Icon(Icons.badge_outlined),
        ),
        // The field is one line tall; the open menu can show two lines.
        selectedItemBuilder: (context) => [
          const Text(
            'Sin cuenta',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          for (final member in available)
            Text(member.name, maxLines: 1, overflow: TextOverflow.ellipsis),
          if (selectedMember != null &&
              !available.any((m) => m.userId == selectedMember.userId))
            Text(
              selectedMember.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
        ],
        items: items,
        onChanged: enabled ? onChanged : null,
      ),
    );
  }
}

class _MemberLabel extends StatelessWidget {
  const _MemberLabel({required this.member});

  final TeamMember member;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          member.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.bodyLarge,
        ),
        Text(
          member.email,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
