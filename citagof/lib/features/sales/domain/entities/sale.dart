enum PaymentMethod {
  cash('CASH', 'Efectivo'),
  card('CARD', 'Tarjeta'),
  transfer('TRANSFER', 'Transferencia'),
  other('OTHER', 'Otro');

  const PaymentMethod(this.wire, this.label);

  final String wire;

  final String label;

  static PaymentMethod parse(String value) => PaymentMethod.values.firstWhere(
    (method) => method.wire == value,
    orElse: () => throw FormatException('Unknown payment method: $value'),
  );
}

enum SaleStatus {
  pending('PENDING', 'Pendiente'),
  paid('PAID', 'Pagada'),
  cancelled('CANCELLED', 'Anulada'),
  refunded('REFUNDED', 'Devuelta');

  const SaleStatus(this.wire, this.label);

  final String wire;
  final String label;

  static SaleStatus parse(String value) => SaleStatus.values.firstWhere(
    (status) => status.wire == value,
    orElse: () => throw FormatException('Unknown sale status: $value'),
  );
}

class SaleRef {
  const SaleRef({required this.id, required this.name});

  final String id;
  final String name;
}

class SaleLine {
  const SaleLine({
    required this.description,
    required this.unitPrice,
    required this.quantity,
    this.id,
    this.serviceId,
    this.lineTotal,
  });

  final String? id;
  final String? serviceId;
  final String description;

  final String unitPrice;
  final int quantity;

  final String? lineTotal;
}

class Sale {
  const Sale({
    required this.id,
    required this.status,
    required this.currency,
    required this.subtotal,
    required this.discount,
    required this.total,
    required this.lines,
    this.paymentMethod,
    this.soldAt,
    this.paidAt,
    this.voidedAt,
    this.voidReason,
    this.appointmentId,
    this.client,
    this.staffMember,
  });

  final String id;
  final SaleStatus status;
  final String currency;
  final String subtotal;
  final String discount;
  final String total;
  final PaymentMethod? paymentMethod;
  final List<SaleLine> lines;

  final DateTime? soldAt;

  final DateTime? paidAt;

  final DateTime? voidedAt;

  final String? voidReason;

  final String? appointmentId;

  final SaleRef? client;
  final SaleRef? staffMember;

  bool get canPay => status == SaleStatus.pending;

  bool get canCancel => status == SaleStatus.pending;

  bool get canRefund => status == SaleStatus.paid;

  static bool canManage(bool managesBusiness) => managesBusiness;
}

class RegisterSaleInput {
  const RegisterSaleInput({
    required this.appointmentId,
    required this.discount,
    this.paymentMethod,
  });

  final String appointmentId;

  final String discount;

  final PaymentMethod? paymentMethod;
}

enum SalesStatusFilter {
  all(null, 'Todas'),
  paid(SaleStatus.paid, 'Cobradas'),
  pending(SaleStatus.pending, 'Pendientes'),
  cancelled(SaleStatus.cancelled, 'Anuladas'),
  refunded(SaleStatus.refunded, 'Reembolsadas');

  const SalesStatusFilter(this.status, this.label);

  final SaleStatus? status;

  final String label;
}
