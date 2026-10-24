import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../billing_routes.dart';
import '../providers/billing_providers.dart';

/// One line above the navigation bar while the business is on its free trial,
/// and a red one once the trial ended. It stays silent while loading or when
/// the request fails: a banner about billing must never get in the way of work.
class SubscriptionBanner extends ConsumerWidget {
  const SubscriptionBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subscription = ref.watch(subscriptionProvider).value;
    if (subscription == null) return const SizedBox.shrink();

    final colors = AppStatusColors.of(context);
    final tone = subscription.isExpired ? StatusTone.danger : StatusTone.info;
    final foreground = colors.foreground(tone);
    final theme = Theme.of(context);

    final message = subscription.isExpired
        ? 'Tu prueba gratis terminó: solo puedes ver tus datos'
        : subscription.daysLeft == 1
        ? 'Prueba gratis: te queda 1 día'
        : 'Prueba gratis: te quedan ${subscription.daysLeft} días';

    return Material(
      color: colors.background(tone),
      child: InkWell(
        onTap: () => context.push(BillingRoutes.root),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.page,
            vertical: AppSpacing.s,
          ),
          child: Row(
            children: [
              Icon(
                subscription.isExpired
                    ? Icons.lock_outline_rounded
                    : Icons.timer_outlined,
                size: 18,
                color: foreground,
              ),
              const SizedBox(width: AppSpacing.s),
              Expanded(
                child: Text(
                  message,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: foreground,
                  ),
                ),
              ),
              Text(
                'Ver planes',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: foreground,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
