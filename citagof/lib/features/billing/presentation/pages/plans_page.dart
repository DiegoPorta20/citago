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

class _PlansPageState extends ConsumerState<PlansPage>
    with WidgetsBindingObserver {
  PlanCode? _selected;
  bool _busy = false;
  String? _error;

  /// The card form is open in the browser; the app is waiting for the result.
  PlanCode? _payingFor;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Coming back from the browser: the payment may have gone through.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _payingFor != null) {
      ref.invalidate(subscriptionProvider);
    }
  }

  void _notify(String message) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  /// Runs [action] with the page marked busy; shows the failure, if any.
  Future<bool> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on Object catch (error) {
      if (!mounted) return false;
      setState(() {
        _busy = false;
        _error = failureMessage(error);
      });
      return false;
    }
    if (!mounted) return false;
    setState(() => _busy = false);
    return true;
  }

  Future<void> _save(Plan plan) async {
    final saved = await _run(
      () => ref.read(choosePlanUseCaseProvider)(plan.code),
    );
    if (!saved) return;
    ref.invalidate(subscriptionProvider);
    setState(() => _selected = null);
    _notify('Elegiste el plan ${plan.name}. Aún no se cobró nada.');
  }

  Future<void> _pay(Plan plan) async {
    var opened = false;
    final started = await _run(() async {
      final session = await ref.read(startCheckoutUseCaseProvider)(plan.code);
      opened = await ref.read(urlOpenerProvider)(session.url);
      if (!opened) {
        throw const AppFailure(
          message: 'No pudimos abrir el navegador. Inténtalo de nuevo.',
        );
      }
    });
    if (!started || !mounted) return;
    setState(() => _payingFor = plan.code);
  }

  Future<void> _cancelSubscription() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Cancelar la suscripción?'),
        content: const Text(
          'Dejaremos de cobrarte cada mes. Puedes seguir usando tu plan hasta '
          'que termine el periodo ya pagado.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Volver'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cancelar suscripción'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final cancelled = await _run(
      () => ref.read(cancelSubscriptionUseCaseProvider)(),
    );
    if (!cancelled) return;
    ref.invalidate(subscriptionProvider);
    _notify('Suscripción cancelada. No se cobrará de nuevo.');
  }

  /// "Ya pagué": ask the server instead of waiting for the app to resume.
  void _checkPayment() => ref.invalidate(subscriptionProvider);

  @override
  Widget build(BuildContext context) {
    ref.listen(subscriptionProvider, (_, next) {
      final paying = _payingFor;
      final current = next.value;
      if (paying == null || current == null) return;
      if (current.state == SubscriptionState.active &&
          current.renews &&
          current.plan.code == paying) {
        setState(() {
          _payingFor = null;
          _selected = null;
        });
        _notify('¡Listo! Tu plan ${current.plan.name} está activo.');
      }
    });

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
              child: _content(
                subscription.value!,
                plans.value!,
                isOwner: isOwner,
              ),
            ),
      bottomNavigationBar: isOwner && loaded
          ? _bottomBar(subscription.value!, selectedPlan)
          : null,
    );
  }

  Widget _content(
    Subscription subscription,
    List<Plan> plans, {
    required bool isOwner,
  }) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.s,
        AppSpacing.page,
        AppSpacing.xxxl,
      ),
      children: [
        _StatusCard(subscription: subscription),
        if (_payingFor != null) ...[
          const SizedBox(height: AppSpacing.m),
          _WaitingForPayment(onCheck: _checkPayment),
        ],
        const SizedBox(height: AppSpacing.xxl),
        const SectionHeader(title: 'Planes'),
        const SizedBox(height: AppSpacing.s),
        Text(
          isOwner
              ? 'Elige el que mejor se ajuste al tamaño de tu equipo.'
              : 'Solo el propietario puede elegir el plan.',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: AppSpacing.l),
        for (final plan in plans) ...[
          _PlanCard(
            plan: plan,
            isCurrent: plan.code == subscription.plan.code,
            isSelected: plan.code == _selected,
            onTap: isOwner && !_busy
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
          subscription.paymentsEnabled
              ? 'Los precios son mensuales. Pagas con tarjeta en una página '
                    'segura de Culqi: CitaGo nunca ve el número de tu tarjeta.'
              : 'Los precios son mensuales. Los pagos en línea todavía no '
                    'están activos: tu elección queda guardada.',
          style: muted,
        ),
        if (isOwner && subscription.renews) ...[
          const SizedBox(height: AppSpacing.l),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _busy ? null : _cancelSubscription,
              icon: const Icon(Icons.event_busy_outlined),
              label: const Text('Cancelar suscripción'),
            ),
          ),
        ],
      ],
    );
  }

  Widget? _bottomBar(Subscription subscription, Plan? selectedPlan) {
    final spinner = const SizedBox.square(
      dimension: 20,
      child: CircularProgressIndicator(strokeWidth: 2),
    );

    // Paying online is not available: the only thing to do is record the
    // preference, and only while nothing is being charged.
    if (!subscription.paymentsEnabled) {
      if (subscription.renews) return null;
      return BottomActionBar(
        error: _error,
        child: FilledButton(
          onPressed: selectedPlan == null || _busy
              ? null
              : () => _save(selectedPlan),
          child: _busy
              ? spinner
              : Text(
                  selectedPlan == null
                      ? 'Elige un plan'
                      : 'Elegir plan ${selectedPlan.name}',
                ),
        ),
      );
    }

    // Behind on the renewal: paying again, on the same plan, fixes it.
    final target =
        selectedPlan ??
        (subscription.state == SubscriptionState.pastDue
            ? subscription.plan
            : null);
    // Already paying for exactly this plan: nothing to buy.
    final alreadyActive =
        target != null &&
        subscription.state == SubscriptionState.active &&
        subscription.renews &&
        target.code == subscription.plan.code;

    final String label;
    if (target == null) {
      label = subscription.renews
          ? 'Elige otro plan para cambiar'
          : 'Elige un plan';
    } else if (alreadyActive) {
      label = 'Este es tu plan actual';
    } else if (subscription.state == SubscriptionState.pastDue &&
        target.code == subscription.plan.code) {
      label = 'Pagar la renovación';
    } else {
      label =
          '${subscription.renews ? 'Cambiar a' : 'Pagar'} ${target.name} · '
          '${formatMoney(target.monthlyPrice, target.currency)}';
    }

    return BottomActionBar(
      error: _error,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FilledButton.icon(
            onPressed: target == null || alreadyActive || _busy
                ? null
                : () => _pay(target),
            icon: _busy ? null : const Icon(Icons.credit_card_rounded),
            label: _busy ? spinner : Text(label),
          ),
          // A paying business changes plan by paying; saving a preference is
          // only for those who are not charged yet.
          if (!subscription.renews && selectedPlan != null)
            TextButton(
              onPressed: _busy ? null : () => _save(selectedPlan),
              child: Text('Solo guardar ${selectedPlan.name} por ahora'),
            ),
        ],
      ),
    );
  }
}

class _WaitingForPayment extends StatelessWidget {
  const _WaitingForPayment({required this.onCheck});

  final VoidCallback onCheck;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.l),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Completa el pago en el navegador',
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Cuando termines, vuelve aquí: tu plan se actualizará solo.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AppSpacing.s),
          TextButton.icon(
            onPressed: onCheck,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Ya pagué, actualizar'),
          ),
        ],
      ),
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
    final clock = ref.watch(businessClockProvider);

    String day(DateTime instant) =>
        BusinessClock.longDate(clock.dateOf(instant));

    final periodEnd = subscription.currentPeriodEnd;
    final (
      StatusTone tone,
      IconData icon,
      String title,
      String message,
    ) = switch (subscription.state) {
      SubscriptionState.expired => (
        StatusTone.danger,
        Icons.lock_outline_rounded,
        'Tu prueba gratis terminó',
        'Puedes seguir viendo tu agenda, clientes y ventas, pero no hacer '
            'cambios hasta elegir un plan.',
      ),
      SubscriptionState.trialing => (
        StatusTone.success,
        Icons.celebration_outlined,
        'Prueba gratis',
        '${remainingLabel(subscription.daysLeft)} Termina el '
            '${day(subscription.trialEndsAt)}.',
      ),
      SubscriptionState.active => (
        StatusTone.success,
        Icons.verified_outlined,
        'Plan ${subscription.plan.name} activo',
        periodEnd == null
            ? 'Tu suscripción está al día.'
            : subscription.renews
            ? 'Se renueva el ${day(periodEnd)}.'
            : 'No se renovará. Puedes usarlo hasta el ${day(periodEnd)}.',
      ),
      SubscriptionState.pastDue => (
        StatusTone.warning,
        Icons.credit_card_off_outlined,
        'No pudimos cobrar tu renovación',
        'Sigues pudiendo trabajar unos días. Paga de nuevo para no perder el '
            'acceso.',
      ),
    };
    final color = colors.foreground(tone);

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
            child: Icon(icon, size: 28, color: color),
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
