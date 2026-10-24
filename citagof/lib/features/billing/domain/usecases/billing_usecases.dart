import '../entities/subscription.dart';
import '../repositories/billing_repository.dart';

class ListPlansUseCase {
  const ListPlansUseCase(this._repository);

  final BillingRepository _repository;

  Future<List<Plan>> call() => _repository.plans();
}

class GetSubscriptionUseCase {
  const GetSubscriptionUseCase(this._repository);

  final BillingRepository _repository;

  Future<Subscription> call() => _repository.subscription();
}

class ChoosePlanUseCase {
  const ChoosePlanUseCase(this._repository);

  final BillingRepository _repository;

  Future<Subscription> call(PlanCode code) => _repository.choosePlan(code);
}
