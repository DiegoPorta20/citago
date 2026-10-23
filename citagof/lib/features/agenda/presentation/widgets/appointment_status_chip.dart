import 'package:flutter/material.dart';

import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../domain/entities/appointment_status.dart';

/// Semantic tone of each appointment state. Shared by the status pill, the
/// timeline accent bar and the history dots so they always agree.
StatusTone appointmentTone(AppointmentStatus status) => switch (status) {
  AppointmentStatus.pending => StatusTone.warning,
  AppointmentStatus.confirmed => StatusTone.info,
  AppointmentStatus.arrived => StatusTone.teal,
  AppointmentStatus.inProgress => StatusTone.accent,
  AppointmentStatus.completed => StatusTone.success,
  AppointmentStatus.cancelled => StatusTone.danger,
  AppointmentStatus.noShow => StatusTone.neutral,
};

class AppointmentStatusChip extends StatelessWidget {
  const AppointmentStatusChip({super.key, required this.status});

  final AppointmentStatus status;

  @override
  Widget build(BuildContext context) =>
      StatusPill(label: status.label, tone: appointmentTone(status));
}
