import '../../domain/entities/service.dart';

Service serviceFromJson(Map<String, dynamic> json) => Service(
  id: json['id'] as String,
  name: json['name'] as String,
  durationMinutes: json['durationMinutes'] as int,
  price: json['price'] as String,
  active: json['status'] == 'ACTIVE',
  description: json['description'] as String?,
);

Map<String, dynamic> createServiceBody(ServiceInput input) => {
  'name': input.name.trim(),
  'durationMinutes': input.durationMinutes,
  'price': input.price,
  if (input.description.trim().isNotEmpty)
    'description': input.description.trim(),
};

Map<String, dynamic> updateServiceBody(ServiceInput input) => {
  'name': input.name.trim(),
  'durationMinutes': input.durationMinutes,
  'price': input.price,
  'description': input.description.trim(),
};
