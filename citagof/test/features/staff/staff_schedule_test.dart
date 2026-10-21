import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/staff/data/models/staff_member_model.dart';
import 'package:citagof/features/staff/domain/entities/staff_member.dart';
import 'package:citagof/features/staff/domain/weekly_schedule.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUpAll(initializeBusinessTime);

  group('weekly schedule — building from saved ranges', () {
    test('groups ranges by weekday, 1 = Monday … 7 = Sunday', () {
      final week = WeeklySchedule.fromRanges(const [
        ScheduleRange(weekday: 1, startsAt: '09:00', endsAt: '13:00'),
        ScheduleRange(weekday: 1, startsAt: '14:00', endsAt: '18:00'),
        ScheduleRange(weekday: 6, startsAt: '10:00', endsAt: '14:00'),
      ]);

      expect(week.length, 7);
      expect(week[0].weekday, 1);
      expect(week[0].working, isTrue);
      expect(week[0].ranges.length, 2);
      expect(week[0].ranges.first.start, '09:00');
      expect(week[0].ranges[1].end, '18:00');
      expect(week[1].working, isFalse);
      expect(week[5].weekday, 6);
      expect(week[5].working, isTrue);
      expect(week[6].weekday, 7);
      expect(week[6].working, isFalse);
    });
  });

  group('weekly schedule — validation', () {
    List<WeekdaySchedule> workingDay(List<TimeRange> ranges) => [
      WeekdaySchedule(weekday: 1, working: true, ranges: ranges),
      for (var w = 2; w <= 7; w++)
        WeekdaySchedule(weekday: w, working: false, ranges: const []),
    ];

    test('a valid week has no error', () {
      final error = WeeklySchedule.validate(
        workingDay(const [
          TimeRange(start: '09:00', end: '13:00'),
          TimeRange(start: '14:00', end: '18:00'),
        ]),
      );
      expect(error, isNull);
    });

    test('rejects start not before end', () {
      final error = WeeklySchedule.validate(
        workingDay(const [TimeRange(start: '18:00', end: '09:00')]),
      );
      expect(error, isNotNull);
      expect(error!.kind, ScheduleErrorKind.startNotBeforeEnd);
      expect(error.weekday, 1);
    });

    test('rejects equal start and end', () {
      final error = WeeklySchedule.validate(
        workingDay(const [TimeRange(start: '09:00', end: '09:00')]),
      );
      expect(error!.kind, ScheduleErrorKind.startNotBeforeEnd);
    });

    test('detects overlapping ranges within a day', () {
      final error = WeeklySchedule.validate(
        workingDay(const [
          TimeRange(start: '09:00', end: '13:00'),
          TimeRange(start: '12:00', end: '18:00'),
        ]),
      );
      expect(error!.kind, ScheduleErrorKind.overlap);
    });

    test('touching ranges do not overlap (end == next start)', () {
      final error = WeeklySchedule.validate(
        workingDay(const [
          TimeRange(start: '09:00', end: '13:00'),
          TimeRange(start: '13:00', end: '18:00'),
        ]),
      );
      expect(error, isNull);
    });

    test('rejects a working day with no ranges', () {
      final error = WeeklySchedule.validate(workingDay(const []));
      expect(error!.kind, ScheduleErrorKind.empty);
    });

    test('rejects too many ranges', () {
      final error = WeeklySchedule.validate(
        workingDay(const [
          TimeRange(start: '08:00', end: '09:00'),
          TimeRange(start: '10:00', end: '11:00'),
          TimeRange(start: '12:00', end: '13:00'),
          TimeRange(start: '14:00', end: '15:00'),
          TimeRange(start: '16:00', end: '17:00'),
        ]),
      );
      expect(error!.kind, ScheduleErrorKind.tooMany);
    });

    test('days off are ignored even if their ranges are nonsense', () {
      final week = [
        const WeekdaySchedule(
          weekday: 1,
          working: false,
          ranges: [TimeRange(start: '18:00', end: '09:00')],
        ),
        for (var w = 2; w <= 7; w++)
          WeekdaySchedule(weekday: w, working: false, ranges: const []),
      ];
      expect(WeeklySchedule.validate(week), isNull);
    });
  });

  group('weekly schedule — payload building', () {
    test('flattens working days only, with weekday numbers', () {
      final week = [
        const WeekdaySchedule(
          weekday: 1,
          working: true,
          ranges: [
            TimeRange(start: '09:00', end: '13:00'),
            TimeRange(start: '14:00', end: '18:00'),
          ],
        ),
        const WeekdaySchedule(
          weekday: 2,
          working: false,
          ranges: [TimeRange(start: '09:00', end: '18:00')],
        ),
        const WeekdaySchedule(
          weekday: 7,
          working: true,
          ranges: [TimeRange(start: '10:00', end: '14:00')],
        ),
      ];

      final payload = WeeklySchedule.toPayloadRanges(week);

      expect(payload, [
        {'weekday': 1, 'startsAt': '09:00', 'endsAt': '13:00'},
        {'weekday': 1, 'startsAt': '14:00', 'endsAt': '18:00'},
        {'weekday': 7, 'startsAt': '10:00', 'endsAt': '14:00'},
      ]);
    });
  });

  group('staff member model', () {
    test('parses schedule ranges from the response', () {
      final member = staffMemberFromJson({
        'id': 'm1',
        'displayName': 'Carlos',
        'status': 'ACTIVE',
        'userId': null,
        'schedule': [
          {'weekday': 1, 'startsAt': '09:00', 'endsAt': '18:00'},
        ],
      });
      expect(member.schedule.length, 1);
      expect(member.schedule.first.weekday, 1);
      expect(member.schedule.first.startsAt, '09:00');
    });

    test('create body omits a blank account link', () {
      final body = createStaffBody(
        const StaffMemberInput(displayName: ' Carlos '),
      );
      expect(body, {'displayName': 'Carlos'});
    });

    test('create body includes the account when provided', () {
      final body = createStaffBody(
        const StaffMemberInput(displayName: 'Carlos', userId: 'u1'),
      );
      expect(body, {'displayName': 'Carlos', 'userId': 'u1'});
    });

    test('update body sends null userId to unlink when blank', () {
      final body = updateStaffBody(
        const StaffMemberInput(displayName: 'Carlos'),
      );
      expect(body, {'displayName': 'Carlos', 'userId': null});
    });
  });

  group('time off — local date range to UTC (America/Lima, UTC-5)', () {
    late final BusinessClock clock;
    setUpAll(() => clock = BusinessClock('America/Lima'));

    test('start is 00:00 local, end is 00:00 of the day after the last', () {
      final startsAt = clock.dayRangeUtc('2026-10-01').from;
      final endsAt = clock.dayRangeUtc('2026-10-04').to;

      final body = createTimeOffBody(startsAt: startsAt, endsAt: endsAt);

      expect(body['startsAt'], '2026-10-01T05:00:00.000Z');
      expect(body['endsAt'], '2026-10-05T05:00:00.000Z');
    });

    test('a single-day absence spans exactly 24 hours', () {
      final startsAt = clock.dayRangeUtc('2026-10-01').from;
      final endsAt = clock.dayRangeUtc('2026-10-01').to;
      expect(endsAt.difference(startsAt), const Duration(hours: 24));
      expect(startsAt.isUtc, isTrue);
    });

    test('reason omitted when blank, trimmed when present', () {
      final from = clock.dayRangeUtc('2026-10-01').from;
      final to = clock.dayRangeUtc('2026-10-02').to;
      expect(
        createTimeOffBody(startsAt: from, endsAt: to, reason: '  '),
        isNot(contains('reason')),
      );
      expect(
        createTimeOffBody(
          startsAt: from,
          endsAt: to,
          reason: ' Vacaciones ',
        )['reason'],
        'Vacaciones',
      );
    });
  });

  group('time off — DST case (Europe/Madrid)', () {
    late final BusinessClock clock;
    setUpAll(() => clock = BusinessClock('Europe/Madrid'));

    test('a spring-forward day is 23 hours, so the UTC range is 23h', () {
      final startsAt = clock.dayRangeUtc('2026-03-29').from;
      final endsAt = clock.dayRangeUtc('2026-03-29').to;
      expect(endsAt.difference(startsAt), const Duration(hours: 23));

      final body = createTimeOffBody(startsAt: startsAt, endsAt: endsAt);
      expect(body['startsAt'], '2026-03-28T23:00:00.000Z');
      expect(body['endsAt'], '2026-03-29T22:00:00.000Z');
    });
  });
}
