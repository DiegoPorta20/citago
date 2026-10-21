import '../entities/dashboard.dart';
import '../repositories/dashboard_repository.dart';

class GetBusinessDashboardUseCase {
  const GetBusinessDashboardUseCase(this._repository);

  final DashboardRepository _repository;

  Future<BusinessDashboard> call() => _repository.businessToday();
}

class GetOwnDashboardUseCase {
  const GetOwnDashboardUseCase(this._repository);

  final DashboardRepository _repository;

  Future<OwnDashboard> call() => _repository.ownToday();
}
