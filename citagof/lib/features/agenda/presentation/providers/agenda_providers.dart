import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/providers.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../data/repositories/appointment_repository_impl.dart';
import '../../domain/entities/appointment.dart';
import '../../domain/repositories/appointment_repository.dart';
import '../../domain/usecases/appointment_usecases.dart';

final appointmentRepositoryProvider = Provider<AppointmentRepository>(
  (ref) => AppointmentRepositoryImpl(ref.watch(dioProvider)),
);

final listAgendaUseCaseProvider = Provider(
  (ref) => ListAgendaUseCase(ref.watch(appointmentRepositoryProvider)),
);
final getAppointmentUseCaseProvider = Provider(
  (ref) => GetAppointmentUseCase(ref.watch(appointmentRepositoryProvider)),
);
final getAvailabilityUseCaseProvider = Provider(
  (ref) => GetAvailabilityUseCase(ref.watch(appointmentRepositoryProvider)),
);
final bookAppointmentUseCaseProvider = Provider(
  (ref) => BookAppointmentUseCase(ref.watch(appointmentRepositoryProvider)),
);
final rescheduleAppointmentUseCaseProvider = Provider(
  (ref) =>
      RescheduleAppointmentUseCase(ref.watch(appointmentRepositoryProvider)),
);
final transitionAppointmentUseCaseProvider = Provider(
  (ref) =>
      TransitionAppointmentUseCase(ref.watch(appointmentRepositoryProvider)),
);

class SelectedDayController extends Notifier<String> {
  @override
  String build() => ref.watch(businessClockProvider).today();

  void previous() {
    final clock = ref.read(businessClockProvider);
    state = clock.addDays(state, -1);
  }

  void next() {
    final clock = ref.read(businessClockProvider);
    state = clock.addDays(state, 1);
  }

  /// Same weekday, one week earlier/later: what the week strip arrows do.
  void previousWeek() =>
      state = ref.read(businessClockProvider).addDays(state, -7);

  void nextWeek() => state = ref.read(businessClockProvider).addDays(state, 7);

  void today() {
    state = ref.read(businessClockProvider).today();
  }

  void select(String date) => state = date;
}

final selectedDayProvider = NotifierProvider<SelectedDayController, String>(
  SelectedDayController.new,
);

class AgendaStaffFilterController extends Notifier<String?> {
  @override
  String? build() => null;

  void select(String? staffMemberId) => state = staffMemberId;
}

final agendaStaffFilterProvider =
    NotifierProvider<AgendaStaffFilterController, String?>(
      AgendaStaffFilterController.new,
    );

final agendaDayProvider = FutureProvider.autoDispose<List<Appointment>>((
  ref,
) async {
  final clock = ref.watch(businessClockProvider);
  final date = ref.watch(selectedDayProvider);
  final staffFilter = ref.watch(agendaStaffFilterProvider);
  final range = clock.dayRangeUtc(date);
  return ref.watch(listAgendaUseCaseProvider)(
    from: range.from,
    to: range.to,
    staffMemberId: staffFilter,
  );
});

final appointmentDetailProvider = FutureProvider.autoDispose
    .family<Appointment, String>(
      (ref, id) => ref.watch(getAppointmentUseCaseProvider)(id),
    );
