import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/widgets/error_banner.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../sales/domain/entities/money.dart';
import '../../domain/entities/service.dart';
import '../providers/service_providers.dart';

class ServiceFormPage extends ConsumerWidget {
  const ServiceFormPage({super.key, this.serviceId});

  final String? serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = serviceId;
    if (id == null) {
      return const _ServiceForm();
    }
    final service = ref.watch(serviceDetailProvider(id));
    return service.when(
      loading: () => Scaffold(
        appBar: AppBar(title: const Text('Editar servicio')),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('Editar servicio')),
        body: ErrorView(
          error: error,
          onRetry: () => ref.invalidate(serviceDetailProvider(id)),
        ),
      ),
      data: (data) => _ServiceForm(existing: data),
    );
  }
}

class _ServiceForm extends ConsumerStatefulWidget {
  const _ServiceForm({this.existing});

  final Service? existing;

  @override
  ConsumerState<_ServiceForm> createState() => _ServiceFormState();
}

class _ServiceFormState extends ConsumerState<_ServiceForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _duration = TextEditingController(
    text: widget.existing?.durationMinutes.toString(),
  );
  late final _price = TextEditingController(text: widget.existing?.price);
  late final _description = TextEditingController(
    text: widget.existing?.description,
  );
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.existing != null;

  @override
  void dispose() {
    _name.dispose();
    _duration.dispose();
    _price.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    final input = ServiceInput(
      name: _name.text,
      durationMinutes: int.parse(_duration.text.trim()),
      price: Money.parse(_price.text).toDecimalString(),
      description: _description.text,
    );

    try {
      if (_isEdit) {
        await ref.read(updateServiceUseCaseProvider)(
          widget.existing!.id,
          input,
        );
      } else {
        await ref.read(createServiceUseCaseProvider)(input);
      }
      ref
        ..invalidate(servicesAdminProvider)
        ..invalidate(activeServicesProvider);
      if (_isEdit) {
        ref.invalidate(serviceDetailProvider(widget.existing!.id));
      }
      if (!mounted) return;
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
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Editar servicio' : 'Nuevo servicio'),
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
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.next,
                maxLength: 120,
                decoration: const InputDecoration(labelText: 'Nombre'),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? 'Escribe el nombre'
                    : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _duration,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  labelText: 'Duración (minutos)',
                  helperText: 'Entre 1 y $maxServiceDurationMinutes',
                ),
                validator: _validateDuration,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _price,
                enabled: !_saving,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                textInputAction: TextInputAction.next,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                ],
                decoration: const InputDecoration(
                  labelText: 'Precio',
                  helperText: 'Hasta 2 decimales, por ejemplo 25.00',
                ),
                validator: _validatePrice,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _description,
                enabled: !_saving,
                maxLines: 3,
                maxLength: 500,
                decoration: const InputDecoration(
                  labelText: 'Descripción (opcional)',
                  alignLabelWithHint: true,
                ),
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

  String? _validateDuration(String? value) {
    final minutes = int.tryParse((value ?? '').trim());
    if (minutes == null || minutes < 1 || minutes > maxServiceDurationMinutes) {
      return 'Entre 1 y $maxServiceDurationMinutes minutos';
    }
    return null;
  }

  String? _validatePrice(String? value) {
    final money = Money.tryParse((value ?? '').trim());
    if (money == null || money.isNegative) {
      return 'Escribe un precio válido, por ejemplo 25.00';
    }
    return null;
  }
}
