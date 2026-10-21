import '../../../../core/network/api_response.dart';
import '../entities/client.dart';
import '../repositories/client_repository.dart';

class ListClientsUseCase {
  const ListClientsUseCase(this._repository);

  final ClientRepository _repository;

  Future<Paged<Client>> call({String? query, int page = 1, int limit = 20}) {
    final trimmed = query?.trim();
    return _repository.list(
      query: (trimmed == null || trimmed.isEmpty) ? null : trimmed,
      page: page,
      limit: limit,
    );
  }
}

class GetClientUseCase {
  const GetClientUseCase(this._repository);

  final ClientRepository _repository;

  Future<Client> call(String id) => _repository.get(id);
}

class CreateClientUseCase {
  const CreateClientUseCase(this._repository);

  final ClientRepository _repository;

  Future<Client> call(ClientInput input) => _repository.create(input);
}

class UpdateClientUseCase {
  const UpdateClientUseCase(this._repository);

  final ClientRepository _repository;

  Future<Client> call(String id, ClientInput input) =>
      _repository.update(id, input);
}

class DeleteClientUseCase {
  const DeleteClientUseCase(this._repository);

  final ClientRepository _repository;

  Future<void> call(String id) => _repository.delete(id);
}

class RestoreClientUseCase {
  const RestoreClientUseCase(this._repository);

  final ClientRepository _repository;

  Future<Client> call(String id) => _repository.restore(id);
}
