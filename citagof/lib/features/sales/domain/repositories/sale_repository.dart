import '../../../../core/network/api_response.dart';
import '../entities/sale.dart';

abstract class SaleRepository {
  Future<Sale> register(RegisterSaleInput input);

  Future<Paged<Sale>> list({
    required DateTime from,
    required DateTime to,
    SaleStatus? status,
    int page = 1,
    int limit = 20,
  });

  Future<Sale> get(String id);

  /// The sale that charged [appointmentId], or `null` while it is unbilled.
  Future<Sale?> findByAppointment(String appointmentId);

  Future<Sale> pay(String id, PaymentMethod method);

  Future<Sale> cancel(String id, String reason);

  Future<Sale> refund(String id, String reason);
}
