import '../entities/staff_member.dart';

abstract class StaffRepository {
  Future<List<StaffMember>> list();

  Future<StaffMember> get(String id);

  Future<StaffMember> create(StaffMemberInput input);

  Future<StaffMember> update(String id, StaffMemberInput input);

  Future<StaffMember> activate(String id);

  Future<StaffMember> deactivate(String id);

  Future<StaffMember> replaceSchedule(
    String id,
    List<Map<String, dynamic>> ranges,
  );

  Future<List<TimeOff>> listTimeOff(
    String id, {
    required DateTime from,
    required DateTime to,
  });

  Future<TimeOff> addTimeOff(
    String id, {
    required DateTime startsAt,
    required DateTime endsAt,
    String? reason,
  });

  Future<void> removeTimeOff(String id, String timeOffId);
}
