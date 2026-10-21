import '../../domain/entities/dashboard.dart';

AppointmentCounters _counters(Map<String, dynamic> json) => AppointmentCounters(
  total: json['total'] as int,
  completed: json['completed'] as int,
  cancelled: json['cancelled'] as int,
  noShow: json['noShow'] as int,
);

BusinessDashboard businessDashboardFromJson(Map<String, dynamic> json) {
  final period = json['period'] as Map<String, dynamic>;
  final revenue = json['revenue'] as Map<String, dynamic>;
  return BusinessDashboard(
    from: period['from'] as String,
    to: period['to'] as String,
    currency: json['currency'] as String,
    revenue: Revenue(
      paid: revenue['paid'] as String,
      paidCount: revenue['paidCount'] as int,
      pending: revenue['pending'] as String,
      pendingCount: revenue['pendingCount'] as int,
    ),
    appointments: _counters(json['appointments'] as Map<String, dynamic>),
    newClients: (json['clients'] as Map<String, dynamic>)['created'] as int,
    topServices: [
      for (final row in json['topServices'] as List<dynamic>)
        ServiceSales(
          description: (row as Map<String, dynamic>)['description'] as String,
          quantity: row['quantity'] as int,
          total: row['total'] as String,
        ),
    ],
    staff: [
      for (final row in json['staff'] as List<dynamic>)
        StaffPerformance(
          name: (row as Map<String, dynamic>)['name'] as String,
          completedAppointments: row['completedAppointments'] as int,
          revenue: row['revenue'] as String,
        ),
    ],
  );
}

OwnDashboard ownDashboardFromJson(Map<String, dynamic> json) {
  final period = json['period'] as Map<String, dynamic>;
  return OwnDashboard(
    from: period['from'] as String,
    to: period['to'] as String,
    appointments: _counters(json['appointments'] as Map<String, dynamic>),
  );
}
