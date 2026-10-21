import 'package:flutter/material.dart';

import '../../domain/entities/sale.dart';

Future<PaymentMethod?> askPaymentMethod(BuildContext context) {
  return showDialog<PaymentMethod>(
    context: context,
    builder: (context) => const _PaymentMethodDialog(),
  );
}

class _PaymentMethodDialog extends StatefulWidget {
  const _PaymentMethodDialog();

  @override
  State<_PaymentMethodDialog> createState() => _PaymentMethodDialogState();
}

class _PaymentMethodDialogState extends State<_PaymentMethodDialog> {
  PaymentMethod _method = PaymentMethod.cash;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cobrar venta'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Método de pago'),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              for (final method in PaymentMethod.values)
                ChoiceChip(
                  label: Text(method.label),
                  selected: _method == method,
                  onSelected: (_) => setState(() => _method = method),
                ),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
          onPressed: () => Navigator.pop(context, _method),
          child: const Text('Cobrar'),
        ),
      ],
    );
  }
}
