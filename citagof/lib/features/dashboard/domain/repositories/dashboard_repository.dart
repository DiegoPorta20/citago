import '../entities/dashboard.dart';

abstract class DashboardRepository {
  Future<BusinessDashboard> businessToday();

  Future<OwnDashboard> ownToday();
}
