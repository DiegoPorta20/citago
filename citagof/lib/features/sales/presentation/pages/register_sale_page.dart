import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../../agenda/domain/entities/appointment.dart';
import '../../../agenda/presentation/providers/agenda_providers.dart';
import '../../domain/entities/money.dart';
import '../../domain/entities/sale.dart';
import '../providers/sale_providers.dart';

class RegisterSalePage extends ConsumerWidget {
  const RegisterSalePage({super.key, required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointment = ref.watch(appointmentDetailProvider(appointmentId));

    return Scaffold(
      appBar: AppBar(title: const Text('Cobrar')),
      body: appointment.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () =>
              ref.invalidate(appointmentDetailProvider(appointmentId)),
        ),
        data: (data) => _Form(appointment: data),
      ),
    );
  }
}

class _Form extends ConsumerStatefulWidget {
  const _Form({required this.appointment});

  final Appointment appointment;

  @override
  ConsumerState<_Form> createState() => _FormState();
}

class _FormState extends ConsumerState<_Form> {
  final _discount = TextEditingController(text: '0');
  PaymentMethod _method = PaymentMethod.cash;
  bool _payNow = true;
  bool _saving = false;
  String? _error;

  Money get _subtotal => Money.parse(widget.appointment.price);

  Money? get _discountMoney => Money.tryParse(
    _discount.text.trim().isEmpty ? '0' : _discount.text.trim(),
  );

  Money? get _total {
    final discount = _discountMoney;
    if (discount == null || discount.isNegative) return null;
    if (discount > _subtotal) return null;
    return _subtotal - discount;
  }

  @override
  void dispose() {
    _discount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final discount = _discountMoney;
    if (discount == null || discount.isNegative) {
      setState(() => _error = 'El descuento no es válido.');
      return;
    }
    if (discount > _subtotal) {
      setState(() => _error = 'El descuento no puede superar el subtotal.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(registerSaleUseCaseProvider)(
        RegisterSaleInput(
          appointmentId: widget.appointment.id,
          discount: discount.toDecimalString(),
          paymentMethod: _payNow ? _method : null,
        ),
      );
      ref.invalidate(appointmentDetailProvider(widget.appointment.id));
      ref.invalidate(agendaDayProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Venta registrada.')));
      context.pop();
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
    final currency =
        ref.watch(sessionControllerProvider).value?.tenant.currency ?? 'PEN';
    final theme = Theme.of(context);
    final total = _total;
    final serviceName = widget.appointment.service?.name ?? 'Servicio';

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Detalle', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(serviceName),
            subtitle: const Text('Cantidad: 1'),
            trailing: Text(formatMoney(_subtotal.toDecimalString(), currency)),
          ),
          const Divider(),
          TextField(
            controller: _discount,
            enabled: !_saving,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Descuento',
              prefixIcon: const Icon(Icons.percent_outlined),
              helperText: 'No puede superar el subtotal.',
              errorText: (_discountMoney == null || _discountMoney!.isNegative)
                  ? 'Monto no válido'
                  : (_discountMoney! > _subtotal ? 'Supera el subtotal' : null),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total', style: theme.textTheme.titleLarge),
              Text(
                total == null
                    ? '—'
                    : formatMoney(total.toDecimalString(), currency),
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Cobrar ahora'),
            subtitle: const Text(
              'Si lo apagas, la venta queda pendiente de pago.',
            ),
            value: _payNow,
            onChanged: _saving
                ? null
                : (value) => setState(() => _payNow = value),
          ),
          if (_payNow) ...[
            Text('Método de pago', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                for (final method in PaymentMethod.values)
                  ChoiceChip(
                    label: Text(method.label),
                    selected: _method == method,
                    onSelected: _saving
                        ? null
                        : (_) => setState(() => _method = method),
                  ),
              ],
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Semantics(
              liveRegion: true,
              child: Text(
                _error!,
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: (_saving || total == null) ? null : _submit,
            child: _saving
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  )
                : Text(_payNow ? 'Cobrar' : 'Registrar'),
          ),
        ],
      ),
    );
  }
}
