import 'package:flutter/material.dart';

import '../../domain/entities/appointment_status.dart';

class AppointmentStatusChip extends StatelessWidget {
  const AppointmentStatusChip({super.key, required this.status});

  final AppointmentStatus status;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = _colors(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          color: foreground,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  (Color, Color) _colors(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return switch (status) {
      AppointmentStatus.pending => (
        Colors.amber.shade100,
        Colors.amber.shade900,
      ),
      AppointmentStatus.confirmed => (
        Colors.blue.shade100,
        Colors.blue.shade900,
      ),
      AppointmentStatus.arrived => (Colors.teal.shade100, Colors.teal.shade900),
      AppointmentStatus.inProgress => (
        Colors.indigo.shade100,
        Colors.indigo.shade900,
      ),
      AppointmentStatus.completed => (
        Colors.green.shade100,
        Colors.green.shade900,
      ),
      AppointmentStatus.cancelled => (
        scheme.errorContainer,
        scheme.onErrorContainer,
      ),
      AppointmentStatus.noShow => (Colors.grey.shade300, Colors.grey.shade800),
    };
  }
}
