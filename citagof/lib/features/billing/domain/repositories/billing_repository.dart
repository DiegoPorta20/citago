import '../entities/subscription.dart';

abstract class BillingRepository {
  Future<List<Plan>> plans();

  Future<Subscription> subscription();

  Future<Subscription> choosePlan(PlanCode code);

  /// Asks the server for the link to the Culqi card form for [code].
  Future<CheckoutSession> startCheckout(PlanCode code);

  /// Stops the monthly charge; the paid period stays usable until it ends.
  Future<Subscription> cancelSubscription();
}
