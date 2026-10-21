import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/providers.dart';
import '../../data/repositories/service_repository_impl.dart';
import '../../domain/entities/service.dart';
import '../../domain/repositories/service_repository.dart';
import '../../domain/usecases/service_usecases.dart';

final serviceRepositoryProvider = Provider<ServiceRepository>(
  (ref) => ServiceRepositoryImpl(ref.watch(dioProvider)),
);

final listServicesUseCaseProvider = Provider(
  (ref) => ListServicesUseCase(ref.watch(serviceRepositoryProvider)),
);
final listAllServicesUseCaseProvider = Provider(
  (ref) => ListAllServicesUseCase(ref.watch(serviceRepositoryProvider)),
);
final getServiceUseCaseProvider = Provider(
  (ref) => GetServiceUseCase(ref.watch(serviceRepositoryProvider)),
);
final createServiceUseCaseProvider = Provider(
  (ref) => CreateServiceUseCase(ref.watch(serviceRepositoryProvider)),
);
final updateServiceUseCaseProvider = Provider(
  (ref) => UpdateServiceUseCase(ref.watch(serviceRepositoryProvider)),
);
final activateServiceUseCaseProvider = Provider(
  (ref) => ActivateServiceUseCase(ref.watch(serviceRepositoryProvider)),
);
final deactivateServiceUseCaseProvider = Provider(
  (ref) => DeactivateServiceUseCase(ref.watch(serviceRepositoryProvider)),
);

final activeServicesProvider = FutureProvider.autoDispose<List<Service>>(
  (ref) => ref.watch(listServicesUseCaseProvider)(activeOnly: true),
);

class ServiceFilterController extends Notifier<ServiceFilter> {
  @override
  ServiceFilter build() => ServiceFilter.all;

  void set(ServiceFilter filter) => state = filter;
}

final serviceFilterProvider =
    NotifierProvider.autoDispose<ServiceFilterController, ServiceFilter>(
      ServiceFilterController.new,
    );

final servicesAdminProvider = FutureProvider.autoDispose<List<Service>>((ref) {
  final filter = ref.watch(serviceFilterProvider);
  return ref.watch(listAllServicesUseCaseProvider)(filter: filter);
});

final serviceDetailProvider = FutureProvider.autoDispose
    .family<Service, String>(
      (ref, id) => ref.watch(getServiceUseCaseProvider)(id),
    );
