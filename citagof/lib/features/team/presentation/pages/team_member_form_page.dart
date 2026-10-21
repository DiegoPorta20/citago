import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../authentication/domain/entities/auth_session.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/team_member.dart';
import '../../domain/permissions/team_permissions.dart';
import '../providers/team_providers.dart';
import '../widgets/role_label.dart';
import '../widgets/temporary_password_dialog.dart';

class TeamMemberFormPage extends ConsumerStatefulWidget {
  const TeamMemberFormPage({super.key});

  @override
  ConsumerState<TeamMemberFormPage> createState() => _TeamMemberFormPageState();
}

class _TeamMemberFormPageState extends ConsumerState<TeamMemberFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  UserRole _role = UserRole.staff;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _save(List<UserRole> roles) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    final input = TeamMemberInput(
      name: _name.text,
      email: _email.text,
      role: _role,
    );

    try {
      final added = await ref.read(addTeamMemberUseCaseProvider)(input);
      ref.invalidate(teamListProvider);
      ref.invalidate(teamMembersProvider);
      if (!mounted) return;
      setState(() => _saving = false);
      final password = added.temporaryPassword;
      if (password != null) {
        await showTemporaryPasswordDialog(
          context,
          name: added.member.name,
          password: password,
        );
      }
      if (mounted) context.pop();
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failure.message;
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = 'Algo salió mal. Inténtalo de nuevo.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final actor =
        ref.watch(sessionControllerProvider).value?.role ?? UserRole.staff;
    final roles = TeamPermissions.assignableRoles(actor);
    if (!roles.contains(_role) && roles.isNotEmpty) {
      _role = roles.first;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Dar acceso')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: _name,
                enabled: !_saving,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                maxLength: 120,
                decoration: const InputDecoration(labelText: 'Nombre'),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? 'Escribe el nombre'
                    : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _email,
                enabled: !_saving,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                maxLength: 160,
                decoration: const InputDecoration(labelText: 'Correo'),
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.isEmpty) return 'Escribe el correo';
                  return text.contains('@') ? null : 'Escribe un correo válido';
                },
              ),
              const SizedBox(height: 16),
              Text('Rol', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 4),
              for (final role in roles)
                ListTile(
                  minTileHeight: 56,
                  onTap: _saving ? null : () => setState(() => _role = role),
                  leading: Icon(
                    _role == role
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    color: _role == role
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.outline,
                  ),
                  title: Text(roleLabel(role)),
                  subtitle: Text(_roleHint(role)),
                ),
              const SizedBox(height: 8),
              const Text(
                'Se creará una contraseña temporal que verás una sola vez al '
                'guardar. Entrégasela a la persona para que entre.',
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
                onPressed: _saving ? null : () => _save(roles),
                child: _saving
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      )
                    : const Text('Dar acceso'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _roleHint(UserRole role) => switch (role) {
    UserRole.owner => 'Control total de la cuenta.',
    UserRole.admin => 'Administra el negocio, no el acceso de otros.',
    UserRole.staff => 'Atiende y cobra lo suyo.',
  };
}
