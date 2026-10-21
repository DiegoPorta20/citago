import '../entities/staff_member.dart';
import '../repositories/staff_repository.dart';

class ListStaffUseCase {
  const ListStaffUseCase(this._repository);

  final StaffRepository _repository;

  Future<List<StaffMember>> call() => _repository.list();
}

class GetStaffUseCase {
  const GetStaffUseCase(this._repository);

  final StaffRepository _repository;

  Future<StaffMember> call(String id) => _repository.get(id);
}

class CreateStaffUseCase {
  const CreateStaffUseCase(this._repository);

  final StaffRepository _repository;

  Future<StaffMember> call(StaffMemberInput input) => _repository.create(input);
}

class UpdateStaffUseCase {
  const UpdateStaffUseCase(this._repository);

  final StaffRepository _repository;

  Future<StaffMember> call(String id, StaffMemberInput input) =>
      _repository.update(id, input);
}

class SetStaffStatusUseCase {
  const SetStaffStatusUseCase(this._repository);

  final StaffRepository _repository;

  Future<StaffMember> call(String id, {required bool active}) =>
      active ? _repository.activate(id) : _repository.deactivate(id);
}

class ReplaceScheduleUseCase {
  const ReplaceScheduleUseCase(this._repository);

  final StaffRepository _repository;

  Future<StaffMember> call(String id, List<Map<String, dynamic>> ranges) =>
      _repository.replaceSchedule(id, ranges);
}

class ListTimeOffUseCase {
  const ListTimeOffUseCase(this._repository);

  final StaffRepository _repository;

  Future<List<TimeOff>> call(
    String id, {
    required DateTime from,
    required DateTime to,
  }) => _repository.listTimeOff(id, from: from, to: to);
}

class AddTimeOffUseCase {
  const AddTimeOffUseCase(this._repository);

  final StaffRepository _repository;

  Future<TimeOff> call(
    String id, {
    required DateTime startsAt,
    required DateTime endsAt,
    String? reason,
  }) => _repository.addTimeOff(
    id,
    startsAt: startsAt,
    endsAt: endsAt,
    reason: reason,
  );
}

class RemoveTimeOffUseCase {
  const RemoveTimeOffUseCase(this._repository);

  final StaffRepository _repository;

  Future<void> call(String id, String timeOffId) =>
      _repository.removeTimeOff(id, timeOffId);
}
