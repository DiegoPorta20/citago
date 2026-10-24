import '../entities/subscription.dart';

abstract class BillingRepository {
  Future<List<Plan>> plans();

  Future<Subscription> subscription();

  Future<Subscription> choosePlan(PlanCode code);
}
