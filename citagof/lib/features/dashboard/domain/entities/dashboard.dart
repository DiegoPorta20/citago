class AppointmentCounters {
  const AppointmentCounters({
    required this.total,
    required this.completed,
    required this.cancelled,
    required this.noShow,
  });

  final int total;
  final int completed;
  final int cancelled;
  final int noShow;

  bool get isEmpty => total == 0;
}

class Revenue {
  const Revenue({
    required this.paid,
    required this.paidCount,
    required this.pending,
    required this.pendingCount,
  });

  final String paid;
  final int paidCount;
  final String pending;
  final int pendingCount;
}

class ServiceSales {
  const ServiceSales({
    required this.description,
    required this.quantity,
    required this.total,
  });

  final String description;
  final int quantity;
  final String total;
}

class StaffPerformance {
  const StaffPerformance({
    required this.name,
    required this.completedAppointments,
    required this.revenue,
  });

  final String name;
  final int completedAppointments;
  final String revenue;
}

class BusinessDashboard {
  const BusinessDashboard({
    required this.from,
    required this.to,
    required this.currency,
    required this.revenue,
    required this.appointments,
    required this.newClients,
    required this.topServices,
    required this.staff,
  });

  final String from;
  final String to;
  final String currency;
  final Revenue revenue;
  final AppointmentCounters appointments;
  final int newClients;
  final List<ServiceSales> topServices;
  final List<StaffPerformance> staff;
}

class OwnDashboard {
  const OwnDashboard({
    required this.from,
    required this.to,
    required this.appointments,
  });

  final String from;
  final String to;
  final AppointmentCounters appointments;
}
