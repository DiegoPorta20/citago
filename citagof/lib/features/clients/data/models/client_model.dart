import '../../domain/entities/client.dart';

Client clientFromJson(Map<String, dynamic> json) => Client(
  id: json['id'] as String,
  name: json['name'] as String,
  phone: json['phone'] as String?,
  email: json['email'] as String?,
  notes: json['notes'] as String?,
);

Map<String, dynamic> createClientBody(ClientInput input) => {
  'name': input.name.trim(),
  if (input.phone.trim().isNotEmpty) 'phone': input.phone.trim(),
  if (input.email.trim().isNotEmpty) 'email': input.email.trim(),
  if (input.notes.trim().isNotEmpty) 'notes': input.notes.trim(),
};

Map<String, dynamic> updateClientBody(ClientInput input) => {
  'name': input.name.trim(),
  'phone': input.phone.trim(),
  'email': input.email.trim(),
  'notes': input.notes.trim(),
};
