import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../domain/entities/appointment.dart';
import 'agenda_providers.dart';

final upcomingAppointmentsProvider =
    FutureProvider.autoDispose<List<Appointment>>((ref) async {
      final clock = ref.watch(businessClockProvider);
      final now = DateTime.now().toUtc();

      final today = clock.today();
      final dayAfterTomorrow = clock.addDays(today, 2);
      final to = clock.dayRangeUtc(dayAfterTomorrow).from;

      final appointments = await ref.watch(listAgendaUseCaseProvider)(
        from: now,
        to: to,
      );

      final upcoming =
          appointments
              .where(
                (appointment) =>
                    appointment.status.isUpcomingEligible &&
                    !appointment.startAt.toUtc().isBefore(now),
              )
              .toList()
            ..sort((a, b) => a.startAt.compareTo(b.startAt));

      return upcoming.take(5).toList();
    });
