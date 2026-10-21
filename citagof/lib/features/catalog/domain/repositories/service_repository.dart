import '../entities/service.dart';

abstract class ServiceRepository {
  Future<List<Service>> list({bool activeOnly = false});

  Future<List<Service>> listAll({ServiceFilter filter = ServiceFilter.all});

  Future<Service> get(String id);

  Future<Service> create(ServiceInput input);

  Future<Service> update(String id, ServiceInput input);

  Future<Service> activate(String id);

  Future<Service> deactivate(String id);
}
