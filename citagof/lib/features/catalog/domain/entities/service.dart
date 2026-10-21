class Service {
  const Service({
    required this.id,
    required this.name,
    required this.durationMinutes,
    required this.price,
    required this.active,
    this.description,
  });

  final String id;
  final String name;
  final int durationMinutes;

  final String price;

  final bool active;

  final String? description;
}

class ServiceInput {
  const ServiceInput({
    required this.name,
    required this.durationMinutes,
    required this.price,
    this.description = '',
  });

  final String name;
  final int durationMinutes;
  final String price;
  final String description;
}

enum ServiceFilter {
  active,
  inactive,
  all;

  String? get status => switch (this) {
    ServiceFilter.active => 'ACTIVE',
    ServiceFilter.inactive => 'INACTIVE',
    ServiceFilter.all => null,
  };

  String get label => switch (this) {
    ServiceFilter.active => 'Activos',
    ServiceFilter.inactive => 'Inactivos',
    ServiceFilter.all => 'Todos',
  };
}

const int maxServiceDurationMinutes = 720;
