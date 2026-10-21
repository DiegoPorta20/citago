import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/time/business_clock.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../../catalog/domain/entities/service.dart';
import '../../../catalog/presentation/providers/service_providers.dart';
import '../../../clients/domain/entities/client.dart';
import '../../../clients/presentation/pages/client_picker_page.dart';
import '../../../staff/domain/entities/staff_member.dart';
import '../../../staff/presentation/providers/staff_providers.dart';
import '../../domain/entities/availability.dart';
import '../agenda_routes.dart';
import '../providers/agenda_providers.dart';
import '../providers/availability_provider.dart';

class NewAppointmentPage extends ConsumerStatefulWidget {
  const NewAppointmentPage({super.key});

  @override
  ConsumerState<NewAppointmentPage> createState() => _NewAppointmentPageState();
}

class _NewAppointmentPageState extends ConsumerState<NewAppointmentPage> {
  Client? _client;
  Service? _service;
  StaffMember? _staff;
  String? _date;
  AvailabilitySlot? _slot;
  final _notes = TextEditingController();
  bool _allowOutsideSchedule = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  void _resetSlot() => setState(() => _slot = null);

  Future<void> _pickClient() async {
    final client = await pickClient(context);
    if (client != null) setState(() => _client = client);
  }

  Future<void> _pickDate() async {
    final clock = ref.read(businessClockProvider);
    final todayStr = clock.today();
    final (ty, tm, td) = _parse(todayStr);
    final initial = _date == null ? DateTime(ty, tm, td) : _dateOf(_date!);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(ty, tm, td),
      lastDate: DateTime(ty + 2, tm, td),
    );
    if (picked != null) {
      setState(() {
        _date = _format(picked);
        _slot = null;
      });
    }
  }

  Future<void> _book() async {
    final client = _client;
    final service = _service;
    final staff = _staff;
    final slot = _slot;
    if (client == null || service == null || staff == null || slot == null) {
      setState(() => _error = 'Completa todos los datos de la cita.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final appointment = await ref.read(bookAppointmentUseCaseProvider)(
        BookAppointmentInput(
          clientId: client.id,
          serviceId: service.id,
          staffMemberId: staff.id,
          startAt: slot.startAt,
          notes: _notes.text,
          allowOutsideSchedule: _allowOutsideSchedule,
        ),
      );
      ref.invalidate(agendaDayProvider);
      if (!mounted) return;
      context.pushReplacement(AgendaRoutes.detail(appointment.id));
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failureMessage(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final managesBusiness =
        ref.watch(sessionControllerProvider).value?.role.managesBusiness ??
        false;

    return Scaffold(
      appBar: AppBar(title: const Text('Nueva cita')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _SectionTile(
              icon: Icons.person_outline,
              label: 'Cliente',
              value: _client?.name,
              onTap: _saving ? null : _pickClient,
            ),
            const SizedBox(height: 8),
            _ServiceField(
              value: _service,
              enabled: !_saving,
              onChanged: (service) {
                setState(() => _service = service);
                _resetSlot();
              },
            ),
            const SizedBox(height: 8),
            _StaffField(
              value: _staff,
              enabled: !_saving,
              onChanged: (staff) {
                setState(() => _staff = staff);
                _resetSlot();
              },
            ),
            const SizedBox(height: 8),
            _SectionTile(
              icon: Icons.calendar_today_outlined,
              label: 'Fecha',
              value: _date == null ? null : BusinessClock.longDate(_date!),
              onTap: _saving ? null : _pickDate,
            ),
            const SizedBox(height: 16),
            _SlotPicker(
              staff: _staff,
              service: _service,
              date: _date,
              selected: _slot,
              onSelected: (slot) => setState(() => _slot = slot),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _notes,
              enabled: !_saving,
              maxLines: 3,
              maxLength: 500,
              decoration: const InputDecoration(
                labelText: 'Notas (opcional)',
                alignLabelWithHint: true,
              ),
            ),
            if (managesBusiness)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Permitir fuera de horario'),
                subtitle: const Text(
                  'Reserva aunque el profesional no atienda a esa hora.',
                ),
                value: _allowOutsideSchedule,
                onChanged: _saving
                    ? null
                    : (value) => setState(() => _allowOutsideSchedule = value),
              ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _saving ? null : _book,
              child: _saving
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : const Text('Reservar'),
            ),
          ],
        ),
      ),
    );
  }

  static (int, int, int) _parse(String date) {
    final p = date.split('-');
    return (int.parse(p[0]), int.parse(p[1]), int.parse(p[2]));
  }

  static DateTime _dateOf(String date) {
    final (y, m, d) = _parse(date);
    return DateTime(y, m, d);
  }

  static String _format(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';
}

class _SectionTile extends StatelessWidget {
  const _SectionTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        minTileHeight: 56,
        leading: Icon(icon),
        title: Text(label),
        subtitle: Text(value ?? 'Sin elegir'),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

class _ServiceField extends ConsumerWidget {
  const _ServiceField({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final Service? value;
  final bool enabled;
  final ValueChanged<Service?> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final services = ref.watch(activeServicesProvider);
    return services.when(
      loading: () => const _FieldLoading(label: 'Servicio'),
      error: (error, _) => _FieldError(
        error: error,
        onRetry: () => ref.invalidate(activeServicesProvider),
      ),
      data: (items) => DropdownButtonFormField<Service>(
        initialValue: value,
        decoration: const InputDecoration(
          labelText: 'Servicio',
          prefixIcon: Icon(Icons.content_cut_outlined),
        ),
        items: [
          for (final service in items)
            DropdownMenuItem(
              value: service,
              child: Text('${service.name} · ${service.durationMinutes} min'),
            ),
        ],
        onChanged: enabled ? onChanged : null,
      ),
    );
  }
}

class _StaffField extends ConsumerWidget {
  const _StaffField({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final StaffMember? value;
  final bool enabled;
  final ValueChanged<StaffMember?> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final staff = ref.watch(activeStaffProvider);
    return staff.when(
      loading: () => const _FieldLoading(label: 'Profesional'),
      error: (error, _) => _FieldError(
        error: error,
        onRetry: () => ref.invalidate(staffListProvider),
      ),
      data: (items) => DropdownButtonFormField<StaffMember>(
        initialValue: value,
        decoration: const InputDecoration(
          labelText: 'Profesional',
          prefixIcon: Icon(Icons.badge_outlined),
        ),
        items: [
          for (final member in items)
            DropdownMenuItem(value: member, child: Text(member.displayName)),
        ],
        onChanged: enabled ? onChanged : null,
      ),
    );
  }
}

class _SlotPicker extends ConsumerWidget {
  const _SlotPicker({
    required this.staff,
    required this.service,
    required this.date,
    required this.selected,
    required this.onSelected,
  });

  final StaffMember? staff;
  final Service? service;
  final String? date;
  final AvailabilitySlot? selected;
  final ValueChanged<AvailabilitySlot> onSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (staff == null || service == null || date == null) {
      return const Text(
        'Elige servicio, profesional y fecha para ver los horarios.',
      );
    }
    final query = AvailabilityQuery(
      staffMemberId: staff!.id,
      serviceId: service!.id,
      date: date!,
    );
    final availability = ref.watch(availabilityProvider(query));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Horarios', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        availability.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ErrorView(
            error: error,
            onRetry: () => ref.invalidate(availabilityProvider(query)),
          ),
          data: (data) => data.slots.isEmpty
              ? const Text('No hay horarios disponibles ese día.')
              : Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final slot in data.slots)
                      ChoiceChip(
                        label: Text(slot.localTime),
                        selected: selected?.startAt == slot.startAt,
                        onSelected: (_) => onSelected(slot),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _FieldLoading extends StatelessWidget {
  const _FieldLoading({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(labelText: label),
      child: const SizedBox(
        height: 20,
        child: Center(
          child: SizedBox(
            height: 16,
            width: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      ),
    );
  }
}

class _FieldError extends StatelessWidget {
  const _FieldError({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(failureMessage(error))),
        TextButton(onPressed: onRetry, child: const Text('Reintentar')),
      ],
    );
  }
}
