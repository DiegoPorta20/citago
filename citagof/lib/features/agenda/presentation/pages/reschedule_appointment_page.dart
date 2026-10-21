import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/time/business_clock.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../../staff/domain/entities/staff_member.dart';
import '../../../staff/presentation/providers/staff_providers.dart';
import '../../domain/entities/appointment.dart';
import '../../domain/entities/availability.dart';
import '../agenda_routes.dart';
import '../providers/agenda_providers.dart';
import '../providers/availability_provider.dart';

class RescheduleAppointmentPage extends ConsumerWidget {
  const RescheduleAppointmentPage({super.key, required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointment = ref.watch(appointmentDetailProvider(appointmentId));

    return Scaffold(
      appBar: AppBar(title: const Text('Reagendar')),
      body: appointment.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () =>
              ref.invalidate(appointmentDetailProvider(appointmentId)),
        ),
        data: (data) => _Form(appointment: data),
      ),
    );
  }
}

class _Form extends ConsumerStatefulWidget {
  const _Form({required this.appointment});

  final Appointment appointment;

  @override
  ConsumerState<_Form> createState() => _FormState();
}

class _FormState extends ConsumerState<_Form> {
  StaffMember? _staff;
  String? _date;
  AvailabilitySlot? _slot;
  bool _allowOutsideSchedule = false;
  bool _saving = false;
  String? _error;

  String? get _serviceId => widget.appointment.service?.id;

  String? get _effectiveStaffId =>
      _staff?.id ?? widget.appointment.staffMember?.id;

  Future<void> _pickDate() async {
    final clock = ref.read(businessClockProvider);
    final todayStr = clock.today();
    final (ty, tm, td) = _parse(todayStr);
    final picked = await showDatePicker(
      context: context,
      initialDate: _date == null ? DateTime(ty, tm, td) : _dateOf(_date!),
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

  Future<void> _submit() async {
    final slot = _slot;
    if (slot == null) {
      setState(() => _error = 'Elige un nuevo horario.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(rescheduleAppointmentUseCaseProvider)(
        widget.appointment.id,
        RescheduleInput(
          startAt: slot.startAt,
          staffMemberId: _staff?.id,
          allowOutsideSchedule: _allowOutsideSchedule,
        ),
      );
      ref.invalidate(appointmentDetailProvider(widget.appointment.id));
      ref.invalidate(agendaDayProvider);
      if (!mounted) return;
      context.pushReplacement(AgendaRoutes.detail(widget.appointment.id));
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

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _StaffField(
            value: _staff,
            currentName: widget.appointment.staffMember?.name,
            enabled: !_saving,
            onChanged: (staff) {
              setState(() {
                _staff = staff;
                _slot = null;
              });
            },
          ),
          const SizedBox(height: 8),
          Card(
            margin: EdgeInsets.zero,
            child: ListTile(
              minTileHeight: 56,
              leading: const Icon(Icons.calendar_today_outlined),
              title: const Text('Nueva fecha'),
              subtitle: Text(
                _date == null ? 'Sin elegir' : BusinessClock.longDate(_date!),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: _saving ? null : _pickDate,
            ),
          ),
          const SizedBox(height: 16),
          _SlotPicker(
            staffId: _effectiveStaffId,
            serviceId: _serviceId,
            date: _date,
            selected: _slot,
            onSelected: (slot) => setState(() => _slot = slot),
          ),
          if (managesBusiness)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Permitir fuera de horario'),
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
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  )
                : const Text('Guardar cambios'),
          ),
        ],
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

class _StaffField extends ConsumerWidget {
  const _StaffField({
    required this.value,
    required this.currentName,
    required this.enabled,
    required this.onChanged,
  });

  final StaffMember? value;
  final String? currentName;
  final bool enabled;
  final ValueChanged<StaffMember?> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final staff = ref.watch(activeStaffProvider);
    return staff.when(
      loading: () => const LinearProgressIndicator(),
      error: (error, _) => Text(failureMessage(error)),
      data: (items) => DropdownButtonFormField<StaffMember>(
        initialValue: value,
        decoration: InputDecoration(
          labelText: 'Profesional',
          prefixIcon: const Icon(Icons.badge_outlined),
          helperText: currentName == null
              ? null
              : 'Actual: $currentName. Déjalo en blanco para no cambiarlo.',
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
    required this.staffId,
    required this.serviceId,
    required this.date,
    required this.selected,
    required this.onSelected,
  });

  final String? staffId;
  final String? serviceId;
  final String? date;
  final AvailabilitySlot? selected;
  final ValueChanged<AvailabilitySlot> onSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (staffId == null || serviceId == null || date == null) {
      return const Text('Elige una fecha para ver los horarios.');
    }
    final query = AvailabilityQuery(
      staffMemberId: staffId!,
      serviceId: serviceId!,
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
