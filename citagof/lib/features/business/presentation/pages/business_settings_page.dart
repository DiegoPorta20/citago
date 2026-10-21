import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../authentication/domain/entities/business_registration.dart';
import '../../domain/entities/business.dart';
import '../providers/business_providers.dart';

class BusinessSettingsPage extends ConsumerWidget {
  const BusinessSettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final business = ref.watch(businessProvider);
    return business.when(
      loading: () => Scaffold(
        appBar: AppBar(title: const Text('Editar negocio')),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('Editar negocio')),
        body: ErrorView(
          error: error,
          onRetry: () => ref.invalidate(businessProvider),
        ),
      ),
      data: (data) => _SettingsForm(business: data),
    );
  }
}

List<String> _timezoneOptions(String current) {
  final zones = <String>{current};
  for (final country in supportedCountries) {
    zones.add(country.timezone);
  }
  return zones.toList()..sort();
}

class _SettingsForm extends ConsumerStatefulWidget {
  const _SettingsForm({required this.business});

  final Business business;

  @override
  ConsumerState<_SettingsForm> createState() => _SettingsFormState();
}

class _SettingsFormState extends ConsumerState<_SettingsForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.business.name);
  late final _phone = TextEditingController(text: widget.business.phone);
  late final _email = TextEditingController(text: widget.business.email);
  late String _timezone = widget.business.timezone;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  bool get _timezoneChanged => _timezone != widget.business.timezone;

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    final input = BusinessInput(
      name: _name.text,
      timezone: _timezone,
      phone: _phone.text,
      email: _email.text,
    );

    try {
      await ref.read(updateBusinessUseCaseProvider)(input);
      ref.invalidate(businessProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Cambios guardados.')));
      context.pop();
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failure.message;
      });
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
    final options = _timezoneOptions(widget.business.timezone);

    return Scaffold(
      appBar: AppBar(title: const Text('Editar negocio')),
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
              InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Moneda',
                  helperText: 'No se puede cambiar',
                ),
                child: Text(widget.business.currency),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _timezone,
                decoration: const InputDecoration(labelText: 'Zona horaria'),
                items: [
                  for (final zone in options)
                    DropdownMenuItem(value: zone, child: Text(zone)),
                ],
                onChanged: _saving
                    ? null
                    : (value) {
                        if (value != null) setState(() => _timezone = value);
                      },
              ),
              if (_timezoneChanged) ...[
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.warning_amber_rounded,
                      size: 20,
                      color: Theme.of(context).colorScheme.tertiary,
                    ),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Cambiar la zona horaria recalcula la agenda y los '
                        'totales del día. Los instantes guardados no se '
                        'reescriben.',
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 16),
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
                textInputAction: TextInputAction.done,
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
