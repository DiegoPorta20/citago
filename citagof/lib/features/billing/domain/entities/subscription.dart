enum PlanCode {
  starter('STARTER'),
  pro('PRO'),
  business('BUSINESS');

  const PlanCode(this.apiValue);

  final String apiValue;

  static PlanCode parse(String value) => PlanCode.values.firstWhere(
    (code) => code.apiValue == value,
    orElse: () => throw FormatException('Unknown plan: $value'),
  );
}

class Plan {
  const Plan({
    required this.code,
    required this.name,
    required this.monthlyPrice,
    required this.currency,
    required this.maxStaff,
  });

  final PlanCode code;
  final String name;

  /// Decimal string (`"79.00"`), as the API sends it. Never a double.
  final String monthlyPrice;
  final String currency;
  final int maxStaff;

  /// The plan the app highlights (the one every trial starts on).
  bool get isRecommended => code == PlanCode.pro;
}

enum SubscriptionState {
  /// The free trial is running: everything works.
  trialing,

  /// The trial ended: the business can read but not change anything.
  expired;

  static SubscriptionState parse(String value) => switch (value) {
    'TRIALING' => SubscriptionState.trialing,
    'EXPIRED' => SubscriptionState.expired,
    _ => throw FormatException('Unknown subscription state: $value'),
  };
}

class Subscription {
  const Subscription({
    required this.plan,
    required this.state,
    required this.trialEndsAt,
    required this.daysLeft,
  });

  final Plan plan;
  final SubscriptionState state;
  final DateTime trialEndsAt;
  final int daysLeft;

  bool get isExpired => state == SubscriptionState.expired;
}
