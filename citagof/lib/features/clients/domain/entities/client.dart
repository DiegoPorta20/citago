class Client {
  const Client({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    this.notes,
  });

  final String id;
  final String name;

  final String? phone;
  final String? email;
  final String? notes;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}

class ClientInput {
  const ClientInput({
    required this.name,
    this.phone = '',
    this.email = '',
    this.notes = '',
  });

  final String name;
  final String phone;
  final String email;
  final String notes;
}
