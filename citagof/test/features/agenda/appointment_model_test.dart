import 'package:citagof/features/agenda/data/models/appointment_model.dart';
import 'package:citagof/features/agenda/domain/entities/appointment_status.dart';
import 'package:citagof/features/agenda/domain/entities/availability.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('appointmentFromJson', () {
    test('parses a full appointment with history', () {
      final appointment = appointmentFromJson({
        'id': 'a1',
        'status': 'CONFIRMED',
        'startAt': '2026-10-20T14:00:00.000Z',
        'endAt': '2026-10-20T14:30:00.000Z',
        'price': '25.00',
        'notes': 'Alérgico',
        'source': 'MANUAL',
        'client': {'id': 'c1', 'name': 'Ana', 'phone': '+51999999999'},
        'service': {'id': 's1', 'name': 'Corte'},
        'staffMember': {'id': 'm1', 'name': 'Carlos'},
        'cancellationReason': null,
        'history': [
          {
            'fromStatus': 'PENDING',
            'toStatus': 'CONFIRMED',
            'reason': null,
            'changedByUserId': 'u1',
            'changedAt': '2026-10-19T10:00:00.000Z',
          },
        ],
      });

      expect(appointment.id, 'a1');
      expect(appointment.status, AppointmentStatus.confirmed);
      expect(appointment.startAt.toUtc().hour, 14);
      expect(appointment.price, '25.00');
      expect(appointment.client?.name, 'Ana');
      expect(appointment.service?.name, 'Corte');
      expect(appointment.staffMember?.name, 'Carlos');
      expect(appointment.history, hasLength(1));
      expect(appointment.history.first.fromStatus, AppointmentStatus.pending);
      expect(appointment.history.first.toStatus, AppointmentStatus.confirmed);
    });

    test('tolerates null related refs and missing history', () {
      final appointment = appointmentFromJson({
        'id': 'a2',
        'status': 'PENDING',
        'startAt': '2026-10-20T14:00:00.000Z',
        'endAt': '2026-10-20T14:30:00.000Z',
        'price': '10.00',
        'notes': null,
        'source': 'WHATSAPP',
        'client': null,
        'service': null,
        'staffMember': null,
      });

      expect(appointment.client, isNull);
      expect(appointment.service, isNull);
      expect(appointment.history, isEmpty);
    });
  });

  group('availabilityFromJson', () {
    test('parses slots with UTC instants and local time', () {
      final availability = availabilityFromJson({
        'date': '2026-10-20',
        'timezone': 'America/Lima',
        'durationMinutes': 30,
        'slots': [
          {
            'startAt': '2026-10-20T14:00:00.000Z',
            'endAt': '2026-10-20T14:30:00.000Z',
            'localTime': '09:00',
          },
          {
            'startAt': '2026-10-20T14:30:00.000Z',
            'endAt': '2026-10-20T15:00:00.000Z',
            'localTime': '09:30',
          },
        ],
      });

      expect(availability.date, '2026-10-20');
      expect(availability.durationMinutes, 30);
      expect(availability.slots, hasLength(2));
      final slot = availability.slots.first;
      expect(slot.localTime, '09:00');
      expect(slot.startAt, DateTime.utc(2026, 10, 20, 14));
    });
  });

  group('bookAppointmentBody', () {
    test('sends the slot UTC startAt and omits blank notes', () {
      final body = bookAppointmentBody(
        BookAppointmentInput(
          clientId: 'c1',
          serviceId: 's1',
          staffMemberId: 'm1',
          startAt: DateTime.utc(2026, 10, 20, 14),
          notes: '   ',
        ),
      );

      expect(body['startAt'], '2026-10-20T14:00:00.000Z');
      expect(body.containsKey('notes'), isFalse);
      expect(body.containsKey('allowOutsideSchedule'), isFalse);
    });

    test('includes allowOutsideSchedule only when true', () {
      final body = bookAppointmentBody(
        BookAppointmentInput(
          clientId: 'c1',
          serviceId: 's1',
          staffMemberId: 'm1',
          startAt: DateTime.utc(2026, 10, 20, 14),
          notes: 'ok',
          allowOutsideSchedule: true,
        ),
      );

      expect(body['allowOutsideSchedule'], isTrue);
      expect(body['notes'], 'ok');
    });
  });

  group('rescheduleBody', () {
    test('only sends the fields that change', () {
      final body = rescheduleBody(
        RescheduleInput(startAt: DateTime.utc(2026, 10, 21, 15)),
      );
      expect(body['startAt'], '2026-10-21T15:00:00.000Z');
      expect(body.containsKey('staffMemberId'), isFalse);
    });
  });
}
