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

  /// A plan is paid for: everything works.
  active,

  /// The renewal has not gone through yet. Everything still works for a few
  /// days, but the card has to be fixed.
  pastDue,

  /// Nothing is paid for and the trial is over: read-only.
  expired;

  static SubscriptionState parse(String value) => switch (value) {
    'TRIALING' => SubscriptionState.trialing,
    'ACTIVE' => SubscriptionState.active,
    'PAST_DUE' => SubscriptionState.pastDue,
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
    this.currentPeriodEnd,
    this.renews = false,
    this.paymentsEnabled = false,
  });

  final Plan plan;
  final SubscriptionState state;
  final DateTime trialEndsAt;

  /// Days left in the trial or in the paid period.
  final int daysLeft;

  /// End of the period already paid for; `null` while on the trial.
  final DateTime? currentPeriodEnd;

  /// Whether the card will be charged again (false once cancelled).
  final bool renews;

  /// Whether [plan] can be paid online right now (the server has its payment
  /// gateway configured).
  final bool paymentsEnabled;

  bool get isExpired => state == SubscriptionState.expired;

  bool get isTrialing => state == SubscriptionState.trialing;

  /// A plan has been paid for, whether or not it will renew.
  bool get isPaid =>
      state == SubscriptionState.active || state == SubscriptionState.pastDue;
}

/// A link to the browser page where the card is entered.
class CheckoutSession {
  const CheckoutSession({required this.url, required this.expiresInSeconds});

  final Uri url;
  final int expiresInSeconds;
}
