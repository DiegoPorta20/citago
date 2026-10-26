import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/network/providers.dart';
import '../../data/repositories/billing_repository_impl.dart';
import '../../domain/entities/subscription.dart';
import '../../domain/repositories/billing_repository.dart';
import '../../domain/usecases/billing_usecases.dart';

final billingRepositoryProvider = Provider<BillingRepository>(
  (ref) => BillingRepositoryImpl(ref.watch(dioProvider)),
);

final listPlansUseCaseProvider = Provider(
  (ref) => ListPlansUseCase(ref.watch(billingRepositoryProvider)),
);
final getSubscriptionUseCaseProvider = Provider(
  (ref) => GetSubscriptionUseCase(ref.watch(billingRepositoryProvider)),
);
final choosePlanUseCaseProvider = Provider(
  (ref) => ChoosePlanUseCase(ref.watch(billingRepositoryProvider)),
);
final startCheckoutUseCaseProvider = Provider(
  (ref) => StartCheckoutUseCase(ref.watch(billingRepositoryProvider)),
);
final cancelSubscriptionUseCaseProvider = Provider(
  (ref) => CancelSubscriptionUseCase(ref.watch(billingRepositoryProvider)),
);

/// Opens a page in the system browser. A provider so tests can swap it: the
/// real one needs a platform.
typedef UrlOpener = Future<bool> Function(Uri url);

final urlOpenerProvider = Provider<UrlOpener>(
  (ref) =>
      (url) => launchUrl(url, mode: LaunchMode.externalApplication),
);

final plansProvider = FutureProvider.autoDispose<List<Plan>>(
  (ref) => ref.watch(listPlansUseCaseProvider)(),
);

final subscriptionProvider = FutureProvider.autoDispose<Subscription>(
  (ref) => ref.watch(getSubscriptionUseCaseProvider)(),
);
