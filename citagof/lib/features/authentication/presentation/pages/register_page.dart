import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../domain/entities/business_registration.dart';
import '../providers/auth_providers.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _business = TextEditingController();
  final _owner = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  BusinessCountry _country = supportedCountries.first;
  bool _obscure = true;

  @override
  void dispose() {
    _business.dispose();
    _owner.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    ref
        .read(registerControllerProvider.notifier)
        .submit(
          BusinessRegistration(
            businessName: _business.text,
            ownerName: _owner.text,
            ownerEmail: _email.text,
            password: _password.text,
            country: _country,
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final register = ref.watch(registerControllerProvider);
    final loading = register.isLoading;
    final error = register.error;

    return Scaffold(
      appBar: AppBar(title: const Text('Crear mi negocio')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              TextFormField(
                controller: _business,
                enabled: !loading,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                maxLength: 120,
                decoration: const InputDecoration(
                  labelText: 'Nombre del negocio',
                ),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? 'Escribe el nombre del negocio'
                    : null,
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<BusinessCountry>(
                initialValue: _country,
                decoration: const InputDecoration(
                  labelText: 'País',
                  helperText:
                      'Define la moneda y la zona horaria. La moneda no se '
                      'puede cambiar después.',
                  helperMaxLines: 3,
                ),
                items: [
                  for (final country in supportedCountries)
                    DropdownMenuItem(
                      value: country,
                      child: Text('${country.name} · ${country.currency}'),
                    ),
                ],
                onChanged: loading
                    ? null
                    : (value) => setState(() => _country = value ?? _country),
              ),
              const SizedBox(height: 24),
              TextFormField(
                controller: _owner,
                enabled: !loading,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                maxLength: 120,
                autofillHints: const [AutofillHints.name],
                decoration: const InputDecoration(labelText: 'Tu nombre'),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? 'Escribe tu nombre'
                    : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _email,
                enabled: !loading,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(
                  labelText: 'Correo electrónico',
                ),
                validator: (value) => (value == null || !value.contains('@'))
                    ? 'Escribe un correo válido'
                    : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _password,
                enabled: !loading,
                obscureText: _obscure,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.newPassword],
                onFieldSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  labelText: 'Contraseña',
                  helperText: 'Mínimo $minPasswordLength caracteres',
                  suffixIcon: IconButton(
                    tooltip: _obscure
                        ? 'Mostrar contraseña'
                        : 'Ocultar contraseña',
                    icon: Icon(
                      _obscure ? Icons.visibility : Icons.visibility_off,
                    ),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                validator: (value) =>
                    (value == null || value.length < minPasswordLength)
                    ? 'Usa al menos $minPasswordLength caracteres'
                    : null,
              ),
              if (error != null) ...[
                const SizedBox(height: 16),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    failureMessage(error),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: loading ? null : _submit,
                child: loading
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      )
                    : const Text('Crear negocio'),
              ),
              TextButton(
                onPressed: loading ? null : () => context.pop(),
                child: const Text('Ya tengo cuenta'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
