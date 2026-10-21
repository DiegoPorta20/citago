import '../../../../core/network/api_response.dart';
import '../entities/sale.dart';
import '../repositories/sale_repository.dart';

class RegisterSaleUseCase {
  const RegisterSaleUseCase(this._repository);

  final SaleRepository _repository;

  Future<Sale> call(RegisterSaleInput input) => _repository.register(input);
}

class ListSalesUseCase {
  const ListSalesUseCase(this._repository);

  final SaleRepository _repository;

  Future<Paged<Sale>> call({
    required DateTime from,
    required DateTime to,
    SaleStatus? status,
    int page = 1,
    int limit = 20,
  }) => _repository.list(
    from: from,
    to: to,
    status: status,
    page: page,
    limit: limit,
  );
}

class GetSaleUseCase {
  const GetSaleUseCase(this._repository);

  final SaleRepository _repository;

  Future<Sale> call(String id) => _repository.get(id);
}

class PaySaleUseCase {
  const PaySaleUseCase(this._repository);

  final SaleRepository _repository;

  Future<Sale> call(String id, PaymentMethod method) =>
      _repository.pay(id, method);
}

class CancelSaleUseCase {
  const CancelSaleUseCase(this._repository);

  final SaleRepository _repository;

  Future<Sale> call(String id, String reason) => _repository.cancel(id, reason);
}

class RefundSaleUseCase {
  const RefundSaleUseCase(this._repository);

  final SaleRepository _repository;

  Future<Sale> call(String id, String reason) => _repository.refund(id, reason);
}
