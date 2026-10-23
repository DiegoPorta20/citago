import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/error_banner.dart';
import '../../../../core/widgets/icon_badge.dart';
import '../../domain/entities/whatsapp_channel.dart';
import '../providers/whatsapp_providers.dart';

class WhatsAppConnectPage extends ConsumerStatefulWidget {
  const WhatsAppConnectPage({super.key});

  @override
  ConsumerState<WhatsAppConnectPage> createState() =>
      _WhatsAppConnectPageState();
}

class _WhatsAppConnectPageState extends ConsumerState<WhatsAppConnectPage> {
  final _formKey = GlobalKey<FormState>();
  final _phoneNumberId = TextEditingController();
  final _token = TextEditingController();
  final _wabaId = TextEditingController();
  bool _obscureToken = true;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _phoneNumberId.dispose();
    _token.clear();
    _token.dispose();
    _wabaId.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    final input = WhatsAppConnectInput(
      phoneNumberId: _phoneNumberId.text,
      accessToken: _token.text,
      wabaId: _wabaId.text,
    );

    try {
      await ref.read(connectWhatsAppChannelUseCaseProvider)(input);
    } on AppFailure catch (failure) {
      if (!mounted) return;
      _token.clear();
      setState(() {
        _saving = false;
        _error = failure.message;
      });
      return;
    } on Object {
      if (!mounted) return;
      _token.clear();
      setState(() {
        _saving = false;
        _error = 'Algo salió mal. Inténtalo de nuevo.';
      });
      return;
    }

    _token.clear();
    ref.invalidate(whatsAppChannelProvider);
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Conectar WhatsApp')),
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
              AppCard(
                color: theme.colorScheme.surfaceContainer,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const IconBadge(icon: Icons.info_outline_rounded),
                    const SizedBox(width: AppSpacing.m),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Datos de la aplicación de Meta',
                            style: theme.textTheme.titleSmall,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'En la app de Meta, en WhatsApp > Configuración de '
                            'la API, copia el identificador del número de '
                            'teléfono. El token permanente se genera con un '
                            'usuario del sistema en el Administrador comercial '
                            'de Meta.',
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              TextFormField(
                controller: _phoneNumberId,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                maxLength: 32,
                decoration: const InputDecoration(
                  labelText: 'Identificador del número (phoneNumberId)',
                ),
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.isEmpty) return 'Escribe el identificador';
                  return RegExp(r'^\d{1,32}$').hasMatch(text)
                      ? null
                      : 'Solo dígitos';
                },
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _token,
                enabled: !_saving,
                obscureText: _obscureToken,
                enableSuggestions: false,
                autocorrect: false,
                maxLength: 1024,
                decoration: InputDecoration(
                  labelText: 'Token de acceso permanente',
                  helperText:
                      'No se guarda en el teléfono ni se vuelve a mostrar.',
                  suffixIcon: IconButton(
                    tooltip: _obscureToken ? 'Mostrar' : 'Ocultar',
                    icon: Icon(
                      _obscureToken
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                    onPressed: () =>
                        setState(() => _obscureToken = !_obscureToken),
                  ),
                ),
                validator: (value) {
                  final text = value ?? '';
                  if (text.trim().isEmpty) return 'Pega el token';
                  return text.length >= 20
                      ? null
                      : 'El token parece demasiado corto';
                },
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _wabaId,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                maxLength: 32,
                decoration: const InputDecoration(
                  labelText: 'ID de la cuenta de WhatsApp (opcional)',
                ),
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.isEmpty) return null;
                  return RegExp(r'^\d{1,32}$').hasMatch(text)
                      ? null
                      : 'Solo dígitos';
                },
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
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
                    : const Text('Conectar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
