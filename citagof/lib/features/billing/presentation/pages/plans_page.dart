import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/time/business_clock.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/bottom_action_bar.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../authentication/domain/entities/auth_session.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/subscription.dart';
import '../providers/billing_providers.dart';

class PlansPage extends ConsumerStatefulWidget {
  const PlansPage({super.key});

  @override
  ConsumerState<PlansPage> createState() => _PlansPageState();
}

class _PlansPageState extends ConsumerState<PlansPage> {
  PlanCode? _selected;
  bool _saving = false;
  String? _error;

  Future<void> _save(Plan plan) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(choosePlanUseCaseProvider)(plan.code);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failureMessage(error);
      });
      return;
    }
    if (!mounted) return;
    ref.invalidate(subscriptionProvider);
    setState(() {
      _saving = false;
      _selected = null;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Elegiste el plan ${plan.name}. Todavía no se cobra nada desde la '
          'app.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final subscription = ref.watch(subscriptionProvider);
    final plans = ref.watch(plansProvider);
    final isOwner =
        ref.watch(sessionControllerProvider).value?.role == UserRole.owner;

    final loaded = subscription.value != null && plans.value != null;
    final failure = subscription.error ?? plans.error;

    Plan? selectedPlan;
    if (_selected != null && plans.value != null) {
      selectedPlan = plans.value!.where((p) => p.code == _selected).firstOrNull;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Plan y suscripción')),
      body: failure != null && !loaded
          ? ErrorView(
              error: failure,
              onRetry: () {
                ref.invalidate(subscriptionProvider);
                ref.invalidate(plansProvider);
              },
            )
          : !loaded
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(subscriptionProvider);
                ref.invalidate(plansProvider);
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.page,
                  AppSpacing.s,
                  AppSpacing.page,
                  AppSpacing.xxxl,
                ),
                children: [
                  _StatusCard(subscription: subscription.value!),
                  const SizedBox(height: AppSpacing.xxl),
                  const SectionHeader(title: 'Planes'),
                  const SizedBox(height: AppSpacing.s),
                  Text(
                    isOwner
                        ? 'Elige el que mejor se ajuste al tamaño de tu equipo.'
                        : 'Solo el propietario puede elegir el plan.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.l),
                  for (final plan in plans.value!) ...[
                    _PlanCard(
                      plan: plan,
                      isCurrent: plan.code == subscription.value!.plan.code,
                      isSelected: plan.code == _selected,
                      onTap: isOwner && !_saving
                          ? () => setState(() {
                              _selected = plan.code;
                              _error = null;
                            })
                          : null,
                    ),
                    const SizedBox(height: AppSpacing.m),
                  ],
                  const SizedBox(height: AppSpacing.s),
                  Text(
                    'Los precios son mensuales. Todavía no cobramos desde la '
                    'app: tu elección queda guardada.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
      bottomNavigationBar: isOwner && loaded
          ? BottomActionBar(
              error: _error,
              child: FilledButton(
                onPressed: selectedPlan == null || _saving
                    ? null
                    : () => _save(selectedPlan!),
                child: _saving
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        selectedPlan == null
                            ? 'Elige un plan'
                            : 'Elegir plan ${selectedPlan.name}',
                      ),
              ),
            )
          : null,
    );
  }
}

class _StatusCard extends ConsumerWidget {
  const _StatusCard({required this.subscription});

  final Subscription subscription;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colors = AppStatusColors.of(context);
    final expired = subscription.isExpired;
    final tone = expired ? StatusTone.danger : StatusTone.success;
    final color = colors.foreground(tone);
    final clock = ref.watch(businessClockProvider);

    final title = expired ? 'Tu prueba gratis terminó' : 'Prueba gratis';
    final message = expired
        ? 'Puedes seguir viendo tu agenda, clientes y ventas, pero no hacer '
              'cambios hasta elegir un plan.'
        : '${remainingLabel(subscription.daysLeft)} Termina el '
              '${BusinessClock.longDate(clock.dateOf(subscription.trialEndsAt))}.';

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.xl),
      borderColor: color.withValues(alpha: 0.4),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          colors.background(tone).withValues(alpha: 0.28),
          theme.colorScheme.surfaceContainerLow,
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: colors.background(tone),
              shape: BoxShape.circle,
            ),
            child: Icon(
              expired ? Icons.lock_outline_rounded : Icons.celebration_outlined,
              size: 28,
              color: color,
            ),
          ),
          const SizedBox(width: AppSpacing.l),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleLarge),
                const SizedBox(height: 4),
                Text(
                  message,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// `Te quedan 5 días.` / `Te queda 1 día.`
String remainingLabel(int daysLeft) =>
    daysLeft == 1 ? 'Te queda 1 día.' : 'Te quedan $daysLeft días.';

String staffLimitLabel(int maxStaff) => 'Hasta $maxStaff profesionales';

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.isCurrent,
    required this.isSelected,
    required this.onTap,
  });

  final Plan plan;
  final bool isCurrent;
  final bool isSelected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Semantics(
      button: onTap != null,
      selected: isSelected,
      child: AppCard(
        onTap: onTap,
        padding: const EdgeInsets.all(AppSpacing.l),
        borderColor: isSelected ? scheme.primary : null,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: AppSpacing.s,
                    runSpacing: AppSpacing.xs,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(plan.name, style: theme.textTheme.titleMedium),
                      if (plan.isRecommended)
                        const StatusPill(
                          label: 'Recomendado',
                          tone: StatusTone.accent,
                          showDot: false,
                        ),
                      if (isCurrent)
                        const StatusPill(
                          label: 'Tu plan',
                          tone: StatusTone.success,
                          showDot: false,
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.s),
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: formatMoney(plan.monthlyPrice, plan.currency),
                          style: theme.textTheme.headlineSmall?.copyWith(
                            fontFeatures: AppText.tabular,
                          ),
                        ),
                        TextSpan(
                          text: ' / mes',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s),
                  Row(
                    children: [
                      Icon(
                        Icons.badge_outlined,
                        size: 18,
                        color: scheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: AppSpacing.s),
                      Text(
                        staffLimitLabel(plan.maxStaff),
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (onTap != null)
              Icon(
                isSelected
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_unchecked_rounded,
                color: isSelected ? scheme.primary : scheme.outline,
              ),
          ],
        ),
      ),
    );
  }
}
