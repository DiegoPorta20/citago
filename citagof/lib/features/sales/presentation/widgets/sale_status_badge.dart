import 'package:flutter/material.dart';

import '../../domain/entities/sale.dart';

Color saleStatusColor(SaleStatus status, ColorScheme scheme) =>
    switch (status) {
      SaleStatus.paid => scheme.primary,
      SaleStatus.pending => scheme.tertiary,
      SaleStatus.cancelled => scheme.outline,
      SaleStatus.refunded => scheme.error,
    };

class SaleStatusBadge extends StatelessWidget {
  const SaleStatusBadge({super.key, required this.status});

  final SaleStatus status;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = saleStatusColor(status, scheme);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.label,
        style: Theme.of(context).textTheme.labelMedium
            ?.copyWith(color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}
