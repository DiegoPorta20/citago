import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/utils/money_format.dart';
import '../../../../core/widgets/error_view.dart';
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
            padding: const EdgeInsets.symmetric(vertical: 8),
            children: [
              _SectionHeader(
                title: 'Configuración',
                action: TextButton.icon(
                  onPressed: () => context.push(BusinessRoutes.editSettings),
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Editar'),
                ),
              ),
              _InfoRow(
                icon: Icons.storefront_outlined,
                label: 'Nombre',
                value: data.name,
              ),
              _InfoRow(icon: Icons.public, label: 'País', value: data.country),
              _InfoRow(
                icon: Icons.schedule,
                label: 'Zona horaria',
                value: data.timezone,
              ),
              _InfoRow(
                icon: Icons.payments_outlined,
                label: 'Moneda',
                value: '${data.currency} (${_currencyExample(data.currency)})',
                subtitle: 'No se puede cambiar',
              ),
              _InfoRow(
                icon: Icons.phone_outlined,
                label: 'Teléfono',
                value: data.phone,
              ),
              _InfoRow(
                icon: Icons.email_outlined,
                label: 'Correo',
                value: data.email,
              ),
              const Divider(),
              _SectionHeader(
                title: 'Horario de atención',
                action: TextButton.icon(
                  onPressed: () => context.push(BusinessRoutes.editHours),
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Editar'),
                ),
              ),
              _HoursView(hours: data.hours),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  static String _currencyExample(String currency) => formatMoney('0', currency);
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.action});

  final String title;
  final Widget action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          action,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.subtitle,
  });

  final IconData icon;
  final String label;
  final String? value;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final shown = value == null || value!.isEmpty ? 'Sin datos' : value!;
    return ListTile(
      leading: Icon(icon),
      title: Text(label),
      subtitle: Text(subtitle == null ? shown : '$shown\n$subtitle'),
      isThreeLine: subtitle != null,
    );
  }
}

class _HoursView extends StatelessWidget {
  const _HoursView({required this.hours});

  final List<ScheduleRange> hours;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var weekday = 1; weekday <= 7; weekday++)
          _DayRow(
            label: _weekdayLabels[weekday - 1],
            ranges: hours.where((r) => r.weekday == weekday).toList()
              ..sort((a, b) => a.startMinutes.compareTo(b.startMinutes)),
          ),
      ],
    );
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({required this.label, required this.ranges});

  final String label;
  final List<ScheduleRange> ranges;

  @override
  Widget build(BuildContext context) {
    final closed = ranges.isEmpty;
    return ListTile(
      minTileHeight: 48,
      dense: true,
      title: Text(label),
      trailing: Text(
        closed
            ? 'Cerrado'
            : ranges.map((r) => '${r.startsAt}–${r.endsAt}').join(', '),
        style: TextStyle(
          color: closed
              ? Theme.of(context).colorScheme.outline
              : Theme.of(context).colorScheme.onSurface,
        ),
      ),
    );
  }
}
