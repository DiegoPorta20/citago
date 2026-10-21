import 'package:citagof/features/staff/data/models/staff_member_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('staffMemberFromJson maps fields and active status', () {
    final member = staffMemberFromJson({
      'id': 'm1',
      'displayName': 'Carlos',
      'status': 'ACTIVE',
      'userId': 'u1',
    });
    expect(member.id, 'm1');
    expect(member.displayName, 'Carlos');
    expect(member.active, isTrue);
    expect(member.userId, 'u1');
  });

  test('staffMemberFromJson tolerates a null userId and inactive status', () {
    final member = staffMemberFromJson({
      'id': 'm2',
      'displayName': 'Luis',
      'status': 'INACTIVE',
      'userId': null,
    });
    expect(member.active, isFalse);
    expect(member.userId, isNull);
  });
}
