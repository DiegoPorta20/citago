import '../../../../core/network/api_response.dart';
import '../entities/client.dart';

abstract class ClientRepository {
  Future<Paged<Client>> list({String? query, int page = 1, int limit = 20});

  Future<Client> get(String id);

  Future<Client> create(ClientInput input);

  Future<Client> update(String id, ClientInput input);

  Future<void> delete(String id);

  Future<Client> restore(String id);
}
