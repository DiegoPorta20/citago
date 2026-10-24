import 'package:citagof/core/errors/app_failure.dart';
import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/billing/data/models/billing_model.dart';
import 'package:citagof/features/billing/domain/entities/subscription.dart';
import 'package:citagof/features/billing/domain/repositories/billing_repository.dart';
import 'package:citagof/features/billing/presentation/billing_routes.dart';
import 'package:citagof/features/billing/presentation/providers/billing_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

const _starter = Plan(
  code: PlanCode.starter,
  name: 'Inicial',
  monthlyPrice: '39.00',
  currency: 'PEN',
  maxStaff: 2,
);
const _pro = Plan(
  code: PlanCode.pro,
  name: 'Profesional',
  monthlyPrice: '79.00',
  currency: 'PEN',
  maxStaff: 5,
);
const _business = Plan(
  code: PlanCode.business,
  name: 'Negocio',
  monthlyPrice: '149.00',
  currency: 'PEN',
  maxStaff: 15,
);

Subscription trialing({int daysLeft = 5, Plan plan = _pro}) => Subscription(
  plan: plan,
  state: SubscriptionState.trialing,
  trialEndsAt: DateTime.utc(2026, 10, 29, 17),
  daysLeft: daysLeft,
);

Subscription expired({Plan plan = _pro}) => Subscription(
  plan: plan,
  state: SubscriptionState.expired,
  trialEndsAt: DateTime.utc(2026, 10, 20, 17),
  daysLeft: 0,
);

class FakeBillingRepository implements BillingRepository {
  FakeBillingRepository(this.current);

  Subscription current;
  AppFailure? chooseFailure;
  final List<PlanCode> chosen = [];

  @override
  Future<List<Plan>> plans() async => const [_starter, _pro, _business];

  @override
  Future<Subscription> subscription() async => current;

  @override
  Future<Subscription> choosePlan(PlanCode code) async {
    if (chooseFailure != null) throw chooseFailure!;
    chosen.add(code);
    final plan = [_starter, _pro, _business].firstWhere((p) => p.code == code);
    return current = Subscription(
      plan: plan,
      state: current.state,
      trialEndsAt: current.trialEndsAt,
      daysLeft: current.daysLeft,
    );
  }
}

class FakeSessionController extends SessionController {
  FakeSessionController(this._role);
  final UserRole _role;

  @override
  Future<AuthSession?> build() async => AuthSession(
    user: const SessionUser(id: 'u1', email: 'me@demo.local', name: 'Diego'),
    tenant: const SessionTenant(
      id: 't1',
      name: 'Barbería Demo',
      currency: 'PEN',
      timezone: 'America/Lima',
    ),
    role: _role,
  );
}

Future<void> _pump(
  WidgetTester tester,
  FakeBillingRepository repo, {
  UserRole role = UserRole.owner,
}) async {
  // Tall enough to lay out the three plans and the footer without scrolling.
  tester.view.physicalSize = const Size(800, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final router = GoRouter(
    initialLocation: BillingRoutes.root,
    routes: billingRoutes,
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        billingRepositoryProvider.overrideWithValue(repo),
        businessClockProvider.overrideWithValue(BusinessClock('America/Lima')),
        sessionControllerProvider.overrideWith(
          () => FakeSessionController(role),
        ),
      ],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  group('models', () {
    test('subscriptionFromJson parses the API response', () {
      final subscription = subscriptionFromJson({
        'plan': {
          'code': 'PRO',
          'name': 'Profesional',
          'monthlyPrice': '79.00',
          'currency': 'PEN',
          'maxStaff': 5,
        },
        'state': 'TRIALING',
        'trialEndsAt': '2026-10-29T17:00:00.000Z',
        'daysLeft': 5,
      });

      expect(subscription.plan.code, PlanCode.pro);
      expect(subscription.plan.monthlyPrice, '79.00');
      expect(subscription.state, SubscriptionState.trialing);
      expect(subscription.trialEndsAt.isUtc, isTrue);
      expect(subscription.daysLeft, 5);
      expect(subscription.isExpired, isFalse);
    });

    test('an expired subscription is flagged', () {
      final subscription = subscriptionFromJson({
        'plan': {
          'code': 'BUSINESS',
          'name': 'Negocio',
          'monthlyPrice': '149.00',
          'currency': 'PEN',
          'maxStaff': 15,
        },
        'state': 'EXPIRED',
        'trialEndsAt': '2026-10-20T17:00:00.000Z',
        'daysLeft': 0,
      });

      expect(subscription.isExpired, isTrue);
    });

    test('an unknown plan or state fails loudly instead of guessing', () {
      expect(() => PlanCode.parse('FREE'), throwsFormatException);
      expect(() => SubscriptionState.parse('PAUSED'), throwsFormatException);
    });

    test('choosePlanBody sends the API code', () {
      expect(choosePlanBody(PlanCode.business), {'planCode': 'BUSINESS'});
    });

    test('only the Pro plan is recommended', () {
      expect(_starter.isRecommended, isFalse);
      expect(_pro.isRecommended, isTrue);
      expect(_business.isRecommended, isFalse);
    });

    test('the expired-trial error has a friendly message', () {
      final failure = failureFromApi(
        statusCode: 402,
        code: 'SUBSCRIPTION_EXPIRED',
      );

      expect(failure.message, contains('prueba gratis terminó'));
    });
  });

  group('plans page', () {
    testWidgets('shows the three plans with their prices in soles', (
      tester,
    ) async {
      await _pump(tester, FakeBillingRepository(trialing()));

      expect(find.text('Inicial'), findsOneWidget);
      expect(find.text('Profesional'), findsOneWidget);
      expect(find.text('Negocio'), findsOneWidget);
      expect(find.textContaining('S/ 39.00'), findsOneWidget);
      expect(find.textContaining('S/ 79.00'), findsOneWidget);
      expect(find.textContaining('S/ 149.00'), findsOneWidget);
      expect(find.text('Hasta 2 profesionales'), findsOneWidget);
      expect(find.text('Recomendado'), findsOneWidget);
      expect(find.text('Tu plan'), findsOneWidget);
    });

    testWidgets('tells the owner how many trial days are left', (tester) async {
      await _pump(tester, FakeBillingRepository(trialing(daysLeft: 5)));

      expect(find.text('Prueba gratis'), findsOneWidget);
      expect(find.textContaining('Te quedan 5 días.'), findsOneWidget);
    });

    testWidgets('uses the singular on the last day', (tester) async {
      await _pump(tester, FakeBillingRepository(trialing(daysLeft: 1)));

      expect(find.textContaining('Te queda 1 día.'), findsOneWidget);
    });

    testWidgets('explains the read-only state once the trial ended', (
      tester,
    ) async {
      await _pump(tester, FakeBillingRepository(expired()));

      expect(find.text('Tu prueba gratis terminó'), findsOneWidget);
      expect(
        find.textContaining('no hacer cambios hasta elegir un plan'),
        findsOneWidget,
      );
    });

    testWidgets('the owner picks a plan and it is saved', (tester) async {
      final repo = FakeBillingRepository(trialing());
      await _pump(tester, repo);

      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );

      await tester.tap(find.text('Inicial'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Elegir plan Inicial'));
      await tester.pumpAndSettle();

      expect(repo.chosen, [PlanCode.starter]);
      expect(find.textContaining('Elegiste el plan Inicial'), findsOneWidget);
    });

    testWidgets('an owner can still choose a plan after the trial ended', (
      tester,
    ) async {
      final repo = FakeBillingRepository(expired());
      await _pump(tester, repo);

      await tester.tap(find.text('Negocio'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Elegir plan Negocio'));
      await tester.pumpAndSettle();

      expect(repo.chosen, [PlanCode.business]);
    });

    testWidgets('a failed save shows the message and keeps the choice', (
      tester,
    ) async {
      final repo = FakeBillingRepository(trialing())
        ..chooseFailure = failureFromApi(statusCode: 403, code: 'FORBIDDEN');
      await _pump(tester, repo);

      await tester.tap(find.text('Negocio'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Elegir plan Negocio'));
      await tester.pumpAndSettle();

      expect(find.text('No tienes permiso para hacer esto.'), findsOneWidget);
      expect(find.text('Elegir plan Negocio'), findsOneWidget);
    });

    testWidgets('staff and admins can look but not choose', (tester) async {
      for (final role in [UserRole.staff, UserRole.admin]) {
        final repo = FakeBillingRepository(trialing());
        await _pump(tester, repo, role: role);

        expect(
          find.text('Solo el propietario puede elegir el plan.'),
          findsOneWidget,
        );
        expect(find.byType(FilledButton), findsNothing);

        await tester.tap(find.text('Inicial'));
        await tester.pumpAndSettle();
        expect(repo.chosen, isEmpty);
      }
    });
  });
}
