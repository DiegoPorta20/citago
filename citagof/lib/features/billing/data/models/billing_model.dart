import '../../domain/entities/subscription.dart';

Plan planFromJson(Map<String, dynamic> json) => Plan(
  code: PlanCode.parse(json['code'] as String),
  name: json['name'] as String,
  monthlyPrice: json['monthlyPrice'] as String,
  currency: json['currency'] as String,
  maxStaff: json['maxStaff'] as int,
);

Subscription subscriptionFromJson(Map<String, dynamic> json) => Subscription(
  plan: planFromJson(json['plan'] as Map<String, dynamic>),
  state: SubscriptionState.parse(json['state'] as String),
  trialEndsAt: DateTime.parse(json['trialEndsAt'] as String).toUtc(),
  daysLeft: json['daysLeft'] as int,
);

Map<String, dynamic> choosePlanBody(PlanCode code) => {
  'planCode': code.apiValue,
};
