import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/widgets/error_view.dart';
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
      userId: widget.existing?.userId ?? '',
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
            padding: const EdgeInsets.all(16),
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
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
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
