import 'package:flutter/material.dart';

import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../domain/entities/sale.dart';

StatusTone saleTone(SaleStatus status) => switch (status) {
  SaleStatus.paid => StatusTone.success,
  SaleStatus.pending => StatusTone.warning,
  SaleStatus.cancelled => StatusTone.neutral,
  SaleStatus.refunded => StatusTone.danger,
};

class SaleStatusBadge extends StatelessWidget {
  const SaleStatusBadge({super.key, required this.status});

  final SaleStatus status;

  @override
  Widget build(BuildContext context) =>
      StatusPill(label: status.label, tone: saleTone(status));
}
