import '../../domain/entities/subscription.dart';

Plan planFromJson(Map<String, dynamic> json) => Plan(
  code: PlanCode.parse(json['code'] as String),
  name: json['name'] as String,
  monthlyPrice: json['monthlyPrice'] as String,
  currency: json['currency'] as String,
  maxStaff: json['maxStaff'] as int,
);

Subscription subscriptionFromJson(Map<String, dynamic> json) {
  final periodEnd = json['currentPeriodEnd'] as String?;
  return Subscription(
    plan: planFromJson(json['plan'] as Map<String, dynamic>),
    state: SubscriptionState.parse(json['state'] as String),
    trialEndsAt: DateTime.parse(json['trialEndsAt'] as String).toUtc(),
    daysLeft: json['daysLeft'] as int,
    currentPeriodEnd: periodEnd == null
        ? null
        : DateTime.parse(periodEnd).toUtc(),
    renews: json['renews'] as bool? ?? false,
    paymentsEnabled: json['paymentsEnabled'] as bool? ?? false,
  );
}

CheckoutSession checkoutSessionFromJson(Map<String, dynamic> json) =>
    CheckoutSession(
      url: Uri.parse(json['url'] as String),
      expiresInSeconds: json['expiresInSeconds'] as int,
    );

Map<String, dynamic> choosePlanBody(PlanCode code) => {
  'planCode': code.apiValue,
};

Map<String, dynamic> checkoutBody(PlanCode code) => {'planCode': code.apiValue};
