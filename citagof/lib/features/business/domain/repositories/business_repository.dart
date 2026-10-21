import '../entities/business.dart';

abstract class BusinessRepository {
  Future<Business> get();

  Future<Business> update(BusinessInput input);

  Future<Business> replaceHours(List<ScheduleRange> ranges);
}
