import 'package:citagof/features/agenda/domain/entities/appointment_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('allowedActions', () {
    test('PENDING allows the whole lifecycle', () {
      final actions = allowedActions(AppointmentStatus.pending);
      expect(actions, containsAll(AppointmentAction.values));
    });

    test('CONFIRMED cannot be confirmed again', () {
      final actions = allowedActions(AppointmentStatus.confirmed);
      expect(actions, isNot(contains(AppointmentAction.confirm)));
      expect(
        actions,
        containsAll([
          AppointmentAction.arrive,
          AppointmentAction.start,
          AppointmentAction.complete,
          AppointmentAction.cancel,
          AppointmentAction.noShow,
        ]),
      );
    });

    test('ARRIVED cannot be a no-show', () {
      final actions = allowedActions(AppointmentStatus.arrived);
      expect(actions, isNot(contains(AppointmentAction.noShow)));
      expect(
        actions,
        containsAll([
          AppointmentAction.start,
          AppointmentAction.complete,
          AppointmentAction.cancel,
        ]),
      );
    });

    test('IN_PROGRESS can only complete or cancel', () {
      final actions = allowedActions(AppointmentStatus.inProgress);
      expect(actions, [AppointmentAction.complete, AppointmentAction.cancel]);
    });

    test('NO_SHOW can only complete', () {
      final actions = allowedActions(AppointmentStatus.noShow);
      expect(actions, [AppointmentAction.complete]);
    });

    test('COMPLETED and CANCELLED are terminal', () {
      expect(allowedActions(AppointmentStatus.completed), isEmpty);
      expect(allowedActions(AppointmentStatus.cancelled), isEmpty);
    });
  });

  group('cancellationReasonRequired', () {
    test('is required only when in progress', () {
      expect(cancellationReasonRequired(AppointmentStatus.inProgress), isTrue);
      for (final status in [
        AppointmentStatus.pending,
        AppointmentStatus.confirmed,
        AppointmentStatus.arrived,
      ]) {
        expect(cancellationReasonRequired(status), isFalse);
      }
    });
  });

  group('status flags', () {
    test('terminal statuses', () {
      expect(AppointmentStatus.completed.isTerminal, isTrue);
      expect(AppointmentStatus.cancelled.isTerminal, isTrue);
      expect(AppointmentStatus.pending.isTerminal, isFalse);
    });

    test('reschedulable statuses are pending and confirmed', () {
      expect(AppointmentStatus.pending.isReschedulable, isTrue);
      expect(AppointmentStatus.confirmed.isReschedulable, isTrue);
      expect(AppointmentStatus.arrived.isReschedulable, isFalse);
    });

    test('upcoming eligibility excludes terminal statuses', () {
      expect(AppointmentStatus.pending.isUpcomingEligible, isTrue);
      expect(AppointmentStatus.inProgress.isUpcomingEligible, isTrue);
      expect(AppointmentStatus.completed.isUpcomingEligible, isFalse);
      expect(AppointmentStatus.noShow.isUpcomingEligible, isFalse);
    });

    test('parse round-trips the wire value', () {
      for (final status in AppointmentStatus.values) {
        expect(AppointmentStatus.parse(status.wire), status);
      }
    });
  });
}
