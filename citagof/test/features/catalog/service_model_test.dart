import 'package:citagof/features/catalog/data/models/service_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('serviceFromJson maps ACTIVE status to active', () {
    final service = serviceFromJson({
      'id': 's1',
      'name': 'Corte',
      'durationMinutes': 30,
      'price': '25.00',
      'status': 'ACTIVE',
    });
    expect(service.id, 's1');
    expect(service.name, 'Corte');
    expect(service.durationMinutes, 30);
    expect(service.price, '25.00');
    expect(service.active, isTrue);
  });

  test('serviceFromJson maps INACTIVE status to not active', () {
    final service = serviceFromJson({
      'id': 's2',
      'name': 'Barba',
      'durationMinutes': 15,
      'price': '10.00',
      'status': 'INACTIVE',
    });
    expect(service.active, isFalse);
  });
}
