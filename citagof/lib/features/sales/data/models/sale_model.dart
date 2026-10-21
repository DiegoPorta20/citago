import '../../domain/entities/sale.dart';

SaleLine _saleLineFromJson(Map<String, dynamic> json) => SaleLine(
  id: json['id'] as String?,
  serviceId: json['serviceId'] as String?,
  description: json['description'] as String,
  unitPrice: json['unitPrice'] as String,
  quantity: json['quantity'] as int,
  lineTotal: json['lineTotal'] as String?,
);

SaleRef? _saleRefFromJson(Object? json) => json == null
    ? null
    : SaleRef(
        id: (json as Map<String, dynamic>)['id'] as String,
        name: json['name'] as String,
      );

DateTime? _instant(Object? value) =>
    value == null ? null : DateTime.parse(value as String).toUtc();

Sale saleFromJson(Map<String, dynamic> json) => Sale(
  id: json['id'] as String,
  status: SaleStatus.parse(json['status'] as String),
  currency: json['currency'] as String,
  subtotal: json['subtotal'] as String,
  discount: json['discount'] as String,
  total: json['total'] as String,
  paymentMethod: json['paymentMethod'] == null
      ? null
      : PaymentMethod.parse(json['paymentMethod'] as String),
  soldAt: _instant(json['soldAt']),
  paidAt: _instant(json['paidAt']),
  voidedAt: _instant(json['voidedAt']),
  voidReason: json['voidReason'] as String?,
  appointmentId: json['appointmentId'] as String?,
  client: _saleRefFromJson(json['client']),
  staffMember: _saleRefFromJson(json['staffMember']),
  lines: [
    for (final row in json['lines'] as List<dynamic>)
      _saleLineFromJson(row as Map<String, dynamic>),
  ],
);

Map<String, dynamic> registerSaleBody(RegisterSaleInput input) => {
  'appointmentId': input.appointmentId,
  if (input.discount != '0.00') 'discount': input.discount,
  if (input.paymentMethod != null) 'paymentMethod': input.paymentMethod!.wire,
};

Map<String, dynamic> paySaleBody(PaymentMethod method) => {
  'paymentMethod': method.wire,
};

Map<String, dynamic> voidSaleBody(String reason) => {'reason': reason.trim()};
