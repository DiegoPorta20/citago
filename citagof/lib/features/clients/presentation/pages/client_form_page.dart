import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/client.dart';
import '../clients_routes.dart';
import '../providers/client_providers.dart';

class ClientFormPage extends ConsumerWidget {
  const ClientFormPage({super.key, this.clientId});

  final String? clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = clientId;
    if (id == null) {
      return const _ClientForm();
    }
    final client = ref.watch(clientDetailProvider(id));
    return client.when(
      loading: () => Scaffold(
        appBar: AppBar(title: const Text('Editar cliente')),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('Editar cliente')),
        body: ErrorView(
          error: error,
          onRetry: () => ref.invalidate(clientDetailProvider(id)),
        ),
      ),
      data: (data) => _ClientForm(existing: data),
    );
  }
}

class _ClientForm extends ConsumerStatefulWidget {
  const _ClientForm({this.existing});

  final Client? existing;

  @override
  ConsumerState<_ClientForm> createState() => _ClientFormState();
}

class _ClientFormState extends ConsumerState<_ClientForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _phone = TextEditingController(text: widget.existing?.phone);
  late final _email = TextEditingController(text: widget.existing?.email);
  late final _notes = TextEditingController(text: widget.existing?.notes);
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.existing != null;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    final input = ClientInput(
      name: _name.text,
      phone: _phone.text,
      email: _email.text,
      notes: _notes.text,
    );

    try {
      final saved = _isEdit
          ? await ref.read(updateClientUseCaseProvider)(
              widget.existing!.id,
              input,
            )
          : await ref.read(createClientUseCaseProvider)(input);
      ref.invalidate(clientsListProvider);
      ref.invalidate(clientDetailProvider(saved.id));
      if (!mounted) return;
      if (_isEdit) {
        context.pop();
      } else {
        context.pushReplacement(ClientRoutes.detail(saved.id));
      }
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() => _saving = false);
      await _handleFailure(failure);
    } on Object {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failureMessage(const AppFailure(message: ''));
      });
    }
  }

  Future<void> _handleFailure(AppFailure failure) async {
    final existingId = failure.detail('clientId');

    if (failure.code == 'CLIENT_PHONE_ALREADY_REGISTERED' &&
        existingId != null) {
      final open = await _ask(
        title: 'Ese teléfono ya está registrado',
        body: 'Ya hay un cliente con ese número. ¿Quieres abrirlo?',
        action: 'Abrir cliente',
      );
      if (open == true && mounted) {
        context.pushReplacement(ClientRoutes.detail(existingId));
      }
      return;
    }

    if (failure.code == 'CLIENT_DELETED_WITH_SAME_PHONE' &&
        existingId != null) {
      final canRestore =
          ref.read(sessionControllerProvider).value?.role.managesBusiness ??
          false;
      if (!canRestore) {
        setState(
          () => _error =
              'Un cliente eliminado usa ese teléfono. Pide a un '
              'administrador que lo restaure.',
        );
        return;
      }
      final restore = await _ask(
        title: 'Cliente eliminado',
        body:
            'Un cliente eliminado usa ese teléfono. Restaurarlo conserva '
            'todo su historial.',
        action: 'Restaurar',
      );
      if (restore == true) await _restore(existingId);
      return;
    }

    setState(() => _error = failure.message);
  }

  Future<void> _restore(String id) async {
    setState(() => _saving = true);
    try {
      await ref.read(restoreClientUseCaseProvider)(id);
      ref.invalidate(clientsListProvider);
      ref.invalidate(clientDetailProvider(id));
      if (mounted) context.pushReplacement(ClientRoutes.detail(id));
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failureMessage(error);
      });
    }
  }

  Future<bool?> _ask({
    required String title,
    required String body,
    required String action,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            onPressed: () => Navigator.pop(context, true),
            child: Text(action),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Editar cliente' : 'Nuevo cliente')),
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
                controller: _phone,
                enabled: !_saving,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                maxLength: 32,
                decoration: const InputDecoration(
                  labelText: 'Teléfono (opcional)',
                  helperText: 'Con o sin código de país',
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _email,
                enabled: !_saving,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                maxLength: 160,
                decoration: const InputDecoration(
                  labelText: 'Correo (opcional)',
                ),
                validator: (value) {
                  final text = value?.trim() ?? '';
                  return text.isEmpty || text.contains('@')
                      ? null
                      : 'Escribe un correo válido';
                },
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _notes,
                enabled: !_saving,
                maxLines: 3,
                maxLength: 2000,
                decoration: const InputDecoration(
                  labelText: 'Notas (opcional)',
                  alignLabelWithHint: true,
                ),
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
