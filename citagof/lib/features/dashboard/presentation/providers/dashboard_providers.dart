import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/providers.dart';
import '../../data/repositories/dashboard_repository_impl.dart';
import '../../domain/entities/dashboard.dart';
import '../../domain/repositories/dashboard_repository.dart';
import '../../domain/usecases/dashboard_usecases.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>(
  (ref) => DashboardRepositoryImpl(ref.watch(dioProvider)),
);

final businessDashboardProvider = FutureProvider.autoDispose<BusinessDashboard>(
  (ref) =>
      GetBusinessDashboardUseCase(ref.watch(dashboardRepositoryProvider))(),
);

final ownDashboardProvider = FutureProvider.autoDispose<OwnDashboard>(
  (ref) => GetOwnDashboardUseCase(ref.watch(dashboardRepositoryProvider))(),
);
