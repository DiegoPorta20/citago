import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../dashboard/presentation/providers/dashboard_providers.dart';
import '../../domain/entities/sale.dart';
import '../providers/sale_providers.dart';
import '../widgets/payment_method_dialog.dart';
import '../widgets/void_reason_dialog.dart';

class SaleActions {
  const SaleActions(this.ref);

  final WidgetRef ref;

  void _invalidate(String saleId) {
    ref.invalidate(salesListProvider);
    ref.invalidate(saleDetailProvider(saleId));
    ref.invalidate(businessDashboardProvider);
    ref.invalidate(ownDashboardProvider);
  }

  Future<bool> pay(BuildContext context, Sale sale) async {
    final method = await askPaymentMethod(context);
    if (method == null || !context.mounted) return false;
    try {
      await ref.read(paySaleUseCaseProvider)(sale.id, method);
    } on Object catch (error) {
      if (context.mounted) _notify(context, failureMessage(error));
      return false;
    }
    _invalidate(sale.id);
    if (context.mounted) _notify(context, 'Venta cobrada.');
    return true;
  }

  Future<bool> cancel(BuildContext context, Sale sale) async {
    final reason = await askVoidReason(
      context,
      title: '¿Anular venta?',
      message:
          'La venta quedará anulada y no se podrá editar. Queda en el '
          'historial con el motivo.',
      confirmLabel: 'Anular',
    );
    if (reason == null || !context.mounted) return false;
    try {
      await ref.read(cancelSaleUseCaseProvider)(sale.id, reason);
    } on Object catch (error) {
      if (context.mounted) _notify(context, failureMessage(error));
      return false;
    }
    _invalidate(sale.id);
    if (context.mounted) _notify(context, 'Venta anulada.');
    return true;
  }

  Future<bool> refund(BuildContext context, Sale sale) async {
    final reason = await askVoidReason(
      context,
      title: '¿Reembolsar venta?',
      message:
          'La venta pasará a reembolsada, dejará de contar como ingreso y no '
          'se podrá editar. Queda en el historial con el motivo.',
      confirmLabel: 'Reembolsar',
    );
    if (reason == null || !context.mounted) return false;
    try {
      await ref.read(refundSaleUseCaseProvider)(sale.id, reason);
    } on Object catch (error) {
      if (context.mounted) _notify(context, failureMessage(error));
      return false;
    }
    _invalidate(sale.id);
    if (context.mounted) _notify(context, 'Venta reembolsada.');
    return true;
  }

  void _notify(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message)));
  }
}
