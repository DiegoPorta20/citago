import '../entities/service.dart';
import '../repositories/service_repository.dart';

class ListServicesUseCase {
  const ListServicesUseCase(this._repository);

  final ServiceRepository _repository;

  Future<List<Service>> call({bool activeOnly = false}) =>
      _repository.list(activeOnly: activeOnly);
}

class ListAllServicesUseCase {
  const ListAllServicesUseCase(this._repository);

  final ServiceRepository _repository;

  Future<List<Service>> call({ServiceFilter filter = ServiceFilter.all}) =>
      _repository.listAll(filter: filter);
}

class GetServiceUseCase {
  const GetServiceUseCase(this._repository);

  final ServiceRepository _repository;

  Future<Service> call(String id) => _repository.get(id);
}

class CreateServiceUseCase {
  const CreateServiceUseCase(this._repository);

  final ServiceRepository _repository;

  Future<Service> call(ServiceInput input) => _repository.create(input);
}

class UpdateServiceUseCase {
  const UpdateServiceUseCase(this._repository);

  final ServiceRepository _repository;

  Future<Service> call(String id, ServiceInput input) =>
      _repository.update(id, input);
}

class ActivateServiceUseCase {
  const ActivateServiceUseCase(this._repository);

  final ServiceRepository _repository;

  Future<Service> call(String id) => _repository.activate(id);
}

class DeactivateServiceUseCase {
  const DeactivateServiceUseCase(this._repository);

  final ServiceRepository _repository;

  Future<Service> call(String id) => _repository.deactivate(id);
}
