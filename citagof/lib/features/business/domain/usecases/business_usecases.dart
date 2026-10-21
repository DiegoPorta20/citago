import '../entities/business.dart';
import '../repositories/business_repository.dart';

class GetBusinessUseCase {
  const GetBusinessUseCase(this._repository);

  final BusinessRepository _repository;

  Future<Business> call() => _repository.get();
}

class UpdateBusinessUseCase {
  const UpdateBusinessUseCase(this._repository);

  final BusinessRepository _repository;

  Future<Business> call(BusinessInput input) => _repository.update(input);
}

class ReplaceBusinessHoursUseCase {
  const ReplaceBusinessHoursUseCase(this._repository);

  final BusinessRepository _repository;

  Future<Business> call(List<ScheduleRange> ranges) =>
      _repository.replaceHours(ranges);
}
