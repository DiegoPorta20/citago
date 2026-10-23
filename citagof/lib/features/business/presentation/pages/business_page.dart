import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_status_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/time/business_clock.dart';
import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/info_card.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../../core/widgets/status_pill.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/business.dart';
import '../business_routes.dart';
import '../providers/business_providers.dart';

const _weekdayLabels = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

class BusinessPage extends ConsumerWidget {
  const BusinessPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final business = ref.watch(businessProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Mi negocio')),
      body: business.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(businessProvider),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(businessProvider),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.page,
              AppSpacing.s,
              AppSpacing.page,
              AppSpacing.xxxl,
            ),
            children: [
              SectionHeader(
                title: 'Configuración',
                actionLabel: 'Editar',
                onAction: () => context.push(BusinessRoutes.editSettings),
              ),
              const SizedBox(height: AppSpacing.s),
              InfoCard(
                children: [
                  InfoRow(
                    icon: Icons.storefront_outlined,
                    label: 'Nombre',
                    value: _valueOrEmpty(data.name),
                    emphasize: true,
                  ),
                  InfoRow(
                    icon: Icons.public_rounded,
                    label: 'País',
                    value: _valueOrEmpty(data.country),
                  ),
                  InfoRow(
                    icon: Icons.schedule_rounded,
                    label: 'Zona horaria',
                    value: _valueOrEmpty(data.timezone),
                  ),
                  InfoRow(
                    icon: Icons.payments_outlined,
                    label: 'Moneda',
                    value:
                        '${data.currency} (${_currencyExample(data.currency)})',
                    note: 'No se puede cambiar',
                  ),
                  InfoRow(
                    icon: Icons.phone_outlined,
                    label: 'Teléfono',
                    value: _valueOrEmpty(data.phone),
                  ),
                  InfoRow(
                    icon: Icons.email_outlined,
                    label: 'Correo',
                    value: _valueOrEmpty(data.email),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xxl),
              SectionHeader(
                title: 'Horario de atención',
                actionLabel: 'Editar',
                onAction: () => context.push(BusinessRoutes.editHours),
              ),
              const SizedBox(height: AppSpacing.s),
              _HoursView(hours: data.hours),
            ],
          ),
        ),
      ),
    );
  }

  static String _valueOrEmpty(String? value) =>
      value == null || value.isEmpty ? 'Sin datos' : value;

  static String _currencyExample(String currency) => formatMoney('0', currency);
}

class _HoursView extends ConsumerWidget {
  const _HoursView({required this.hours});

  final List<ScheduleRange> hours;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = BusinessClock.weekdayOf(
      ref.watch(businessClockProvider).today(),
    );

    return AppCard(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.l,
        vertical: AppSpacing.xs,
      ),
      child: Column(
        children: [
          for (var weekday = 1; weekday <= 7; weekday++) ...[
            if (weekday > 1) const Divider(),
            _DayRow(
              label: _weekdayLabels[weekday - 1],
              isToday: weekday == today,
              ranges: hours.where((r) => r.weekday == weekday).toList()
                ..sort((a, b) => a.startMinutes.compareTo(b.startMinutes)),
            ),
          ],
        ],
      ),
    );
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({
    required this.label,
    required this.ranges,
    required this.isToday,
  });

  final String label;
  final List<ScheduleRange> ranges;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final closed = ranges.isEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          Text(
            label,
            style: theme.textTheme.titleSmall?.copyWith(
              color: isToday ? scheme.primary : null,
            ),
          ),
          if (isToday) ...[
            const SizedBox(width: AppSpacing.s),
            const StatusPill(
              label: 'Hoy',
              tone: StatusTone.accent,
              showDot: false,
            ),
          ],
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Text(
              closed
                  ? 'Cerrado'
                  : ranges.map((r) => '${r.startsAt}–${r.endsAt}').join(', '),
              textAlign: TextAlign.end,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: closed ? scheme.onSurfaceVariant : scheme.onSurface,
                fontFeatures: AppText.tabular,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
