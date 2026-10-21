enum AppointmentStatus {
  pending('PENDING'),
  confirmed('CONFIRMED'),
  arrived('ARRIVED'),
  inProgress('IN_PROGRESS'),
  completed('COMPLETED'),
  cancelled('CANCELLED'),
  noShow('NO_SHOW');

  const AppointmentStatus(this.wire);

  final String wire;

  static AppointmentStatus parse(String value) =>
      AppointmentStatus.values.firstWhere(
        (status) => status.wire == value,
        orElse: () =>
            throw FormatException('Unknown appointment status: $value'),
      );

  String get label => switch (this) {
    AppointmentStatus.pending => 'Pendiente',
    AppointmentStatus.confirmed => 'Confirmada',
    AppointmentStatus.arrived => 'En espera',
    AppointmentStatus.inProgress => 'En curso',
    AppointmentStatus.completed => 'Completada',
    AppointmentStatus.cancelled => 'Cancelada',
    AppointmentStatus.noShow => 'No asistió',
  };

  bool get isTerminal =>
      this == AppointmentStatus.completed ||
      this == AppointmentStatus.cancelled;

  bool get isUpcomingEligible =>
      this == AppointmentStatus.pending ||
      this == AppointmentStatus.confirmed ||
      this == AppointmentStatus.arrived ||
      this == AppointmentStatus.inProgress;

  bool get isReschedulable =>
      this == AppointmentStatus.pending || this == AppointmentStatus.confirmed;
}

enum AppointmentAction {
  confirm('Confirmar', AppointmentStatus.confirmed),
  arrive('Marcar llegada', AppointmentStatus.arrived),
  start('Iniciar', AppointmentStatus.inProgress),
  complete('Completar', AppointmentStatus.completed),
  cancel('Cancelar', AppointmentStatus.cancelled),
  noShow('No asistió', AppointmentStatus.noShow);

  const AppointmentAction(this.label, this.target);

  final String label;

  final AppointmentStatus target;
}

const Map<AppointmentStatus, List<AppointmentStatus>> _allowedTransitions = {
  AppointmentStatus.pending: [
    AppointmentStatus.confirmed,
    AppointmentStatus.arrived,
    AppointmentStatus.inProgress,
    AppointmentStatus.completed,
    AppointmentStatus.cancelled,
    AppointmentStatus.noShow,
  ],
  AppointmentStatus.confirmed: [
    AppointmentStatus.arrived,
    AppointmentStatus.inProgress,
    AppointmentStatus.completed,
    AppointmentStatus.cancelled,
    AppointmentStatus.noShow,
  ],
  AppointmentStatus.arrived: [
    AppointmentStatus.inProgress,
    AppointmentStatus.completed,
    AppointmentStatus.cancelled,
  ],
  AppointmentStatus.inProgress: [
    AppointmentStatus.completed,
    AppointmentStatus.cancelled,
  ],
  AppointmentStatus.noShow: [AppointmentStatus.completed],
  AppointmentStatus.completed: [],
  AppointmentStatus.cancelled: [],
};

List<AppointmentAction> allowedActions(AppointmentStatus status) {
  final targets = _allowedTransitions[status] ?? const [];
  return [
    for (final action in AppointmentAction.values)
      if (targets.contains(action.target)) action,
  ];
}

bool cancellationReasonRequired(AppointmentStatus status) =>
    status == AppointmentStatus.inProgress;
