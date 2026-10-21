import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/time/business_clock.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../agenda/presentation/agenda_routes.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/sale.dart';
import '../providers/sale_actions.dart';
import '../providers/sale_providers.dart';
import '../widgets/sale_status_badge.dart';

class SaleDetailPage extends ConsumerWidget {
  const SaleDetailPage({super.key, required this.saleId});

  final String saleId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sale = ref.watch(saleDetailProvider(saleId));

    return Scaffold(
      appBar: AppBar(title: const Text('Venta')),
      body: sale.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(saleDetailProvider(saleId)),
        ),
        data: (data) => _Body(sale: data),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.sale});

  final Sale sale;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final clock = ref.watch(businessClockProvider);
    final managesBusiness =
        ref.watch(sessionControllerProvider).value?.role.managesBusiness ??
        false;
    final currency = sale.currency;

    String when(DateTime? instant) => instant == null
        ? ''
        : '${BusinessClock.longDate(clock.dateOf(instant))}, '
              '${clock.timeOf(instant)}';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                sale.client?.name ?? 'Venta de mostrador',
                style: theme.textTheme.titleLarge,
              ),
            ),
            SaleStatusBadge(status: sale.status),
          ],
        ),
        if (sale.staffMember != null) ...[
          const SizedBox(height: 4),
          Text(
            'Atendió: ${sale.staffMember!.name}',
            style: theme.textTheme.bodyMedium,
          ),
        ],
        if (sale.soldAt != null) ...[
          const SizedBox(height: 4),
          Text(when(sale.soldAt), style: theme.textTheme.bodySmall),
        ],
        const SizedBox(height: 16),
        Text('Detalle', style: theme.textTheme.titleMedium),
        const SizedBox(height: 4),
        for (final line in sale.lines) _LineRow(line: line, currency: currency),
        const Divider(height: 24),
        _AmountRow(
          label: 'Subtotal',
          value: formatMoney(sale.subtotal, currency),
        ),
        _AmountRow(
          label: 'Descuento',
          value: formatMoney(sale.discount, currency),
        ),
        _AmountRow(
          label: 'Total',
          value: formatMoney(sale.total, currency),
          emphasize: true,
        ),
        const SizedBox(height: 16),
        if (sale.paymentMethod != null)
          _InfoRow(
            icon: Icons.payments_outlined,
            label: 'Método de pago',
            value: sale.paymentMethod!.label,
          ),
        if (sale.paidAt != null)
          _InfoRow(
            icon: Icons.check_circle_outline,
            label: 'Cobrada',
            value: when(sale.paidAt),
          ),
        if (sale.voidedAt != null)
          _InfoRow(
            icon: sale.status == SaleStatus.refunded
                ? Icons.undo
                : Icons.cancel_outlined,
            label: sale.status == SaleStatus.refunded
                ? 'Reembolsada'
                : 'Anulada',
            value: when(sale.voidedAt),
          ),
        if (sale.voidReason != null && sale.voidReason!.isNotEmpty)
          _InfoRow(
            icon: Icons.notes_outlined,
            label: 'Motivo',
            value: sale.voidReason,
          ),
        if (sale.appointmentId != null)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.event_outlined),
            title: const Text('Ver la cita'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push(AgendaRoutes.detail(sale.appointmentId!)),
          ),
        const SizedBox(height: 16),
        _Actions(sale: sale, managesBusiness: managesBusiness),
      ],
    );
  }
}

class _Actions extends ConsumerWidget {
  const _Actions({required this.sale, required this.managesBusiness});

  final Sale sale;
  final bool managesBusiness;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final actions = SaleActions(ref);
    final buttons = <Widget>[];

    if (sale.canPay) {
      buttons.add(
        FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          onPressed: () => actions.pay(context, sale),
          icon: const Icon(Icons.payments_outlined),
          label: const Text('Cobrar'),
        ),
      );
    }
    if (sale.canCancel && managesBusiness) {
      buttons.add(
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
          ),
          onPressed: () => actions.cancel(context, sale),
          icon: const Icon(Icons.cancel_outlined),
          label: const Text('Anular'),
        ),
      );
    }
    if (sale.canRefund && managesBusiness) {
      buttons.add(
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
          ),
          onPressed: () => actions.refund(context, sale),
          icon: const Icon(Icons.undo),
          label: const Text('Reembolsar'),
        ),
      );
    }

    if (buttons.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        for (final button in buttons) ...[button, const SizedBox(height: 8)],
      ],
    );
  }
}

class _LineRow extends StatelessWidget {
  const _LineRow({required this.line, required this.currency});

  final SaleLine line;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lineTotal = line.lineTotal ?? line.unitPrice;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(line.description, style: theme.textTheme.bodyLarge),
                Text(
                  '${line.quantity} × ${formatMoney(line.unitPrice, currency)}',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          Text(formatMoney(lineTotal, currency)),
        ],
      ),
    );
  }
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = emphasize
        ? theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)
        : theme.textTheme.bodyLarge;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Text(value, style: style),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(label),
      subtitle: Text(value == null || value!.isEmpty ? 'Sin datos' : value!),
    );
  }
}
