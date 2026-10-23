import 'package:citagof/core/time/business_clock.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUpAll(initializeBusinessTime);

  group('BusinessClock (Lima, UTC-5, no DST)', () {
    late BusinessClock clock;
    setUp(
      () => clock = BusinessClock(
        'America/Lima',
        now: () => DateTime.utc(2026, 10, 21, 3, 30),
      ),
    );

    test('today follows the business zone, not UTC', () {
      expect(clock.today(), '2026-10-20');
    });

    test('a local day maps to UTC instants five hours later', () {
      final range = clock.dayRangeUtc('2026-10-20');
      expect(range.from, DateTime.utc(2026, 10, 20, 5));
      expect(range.to, DateTime.utc(2026, 10, 21, 5));
    });

    test('instantOf and timeOf/dateOf round-trip', () {
      final instant = clock.instantOf('2026-10-20', '09:30');
      expect(instant, DateTime.utc(2026, 10, 20, 14, 30));
      expect(clock.timeOf(instant), '09:30');
      expect(clock.dateOf(instant), '2026-10-20');
    });

    test('addDays crosses month and year boundaries', () {
      expect(clock.addDays('2026-12-31', 1), '2027-01-01');
      expect(clock.addDays('2026-03-01', -1), '2026-02-28');
    });
  });

  test('the DST change day lasts 23 hours (Madrid, 2026-03-29)', () {
    final clock = BusinessClock('Europe/Madrid');
    final range = clock.dayRangeUtc('2026-03-29');
    expect(range.to.difference(range.from), const Duration(hours: 23));
  });

  test('longDate is in Spanish', () {
    expect(BusinessClock.longDate('2026-10-20'), 'martes 20 de octubre');
  });

  group('calendar helpers (weeks run Monday to Sunday)', () {
    // 2026-10-22 is a Thursday.
    test('weekdayOf is 1 for Monday and 7 for Sunday', () {
      expect(BusinessClock.weekdayOf('2026-10-19'), 1);
      expect(BusinessClock.weekdayOf('2026-10-22'), 4);
      expect(BusinessClock.weekdayOf('2026-10-25'), 7);
    });

    test('startOfWeek / endOfWeek bound the Monday-Sunday week', () {
      expect(BusinessClock.startOfWeek('2026-10-22'), '2026-10-19');
      expect(BusinessClock.endOfWeek('2026-10-22'), '2026-10-25');
      expect(BusinessClock.startOfWeek('2026-10-19'), '2026-10-19');
      expect(BusinessClock.endOfWeek('2026-10-25'), '2026-10-25');
    });

    test('a week can cross a month and a year boundary', () {
      expect(BusinessClock.startOfWeek('2026-11-01'), '2026-10-26');
      expect(BusinessClock.endOfWeek('2026-12-31'), '2027-01-03');
      expect(BusinessClock.weekDays('2026-12-31'), [
        '2026-12-28',
        '2026-12-29',
        '2026-12-30',
        '2026-12-31',
        '2027-01-01',
        '2027-01-02',
        '2027-01-03',
      ]);
    });

    test('startOfMonth / endOfMonth are calendar months', () {
      expect(BusinessClock.startOfMonth('2026-10-22'), '2026-10-01');
      expect(BusinessClock.endOfMonth('2026-10-22'), '2026-10-31');
      expect(BusinessClock.endOfMonth('2026-02-10'), '2026-02-28');
      expect(BusinessClock.endOfMonth('2028-02-10'), '2028-02-29');
    });

    test('addMonths clamps the day and crosses years', () {
      expect(BusinessClock.addMonths('2026-01-31', 1), '2026-02-28');
      expect(BusinessClock.addMonths('2026-12-15', 1), '2027-01-15');
      expect(BusinessClock.addMonths('2026-01-15', -1), '2025-12-15');
    });

    test('labels are short, Spanish and consistent', () {
      expect(BusinessClock.weekdayAbbr('2026-10-21'), 'MIÉ');
      expect(BusinessClock.weekdayShort('2026-10-24'), 'sáb');
      expect(BusinessClock.shortDate('2026-10-22'), '22 oct');
      expect(BusinessClock.monthYear('2026-10-22'), 'Octubre 2026');
      expect(
        BusinessClock.longDateCapitalized('2026-10-22'),
        'Jueves 22 de octubre',
      );
      expect(BusinessClock.weekRangeLabel('2026-10-22'), '19 – 25 oct');
      expect(BusinessClock.weekRangeLabel('2026-10-29'), '26 oct – 1 nov');
    });

    test('dayLabel is relative near today and a short date otherwise', () {
      final clock = BusinessClock(
        'America/Lima',
        now: () => DateTime.utc(2026, 10, 22, 15),
      );
      expect(clock.dayLabel('2026-10-22'), 'Hoy');
      expect(clock.dayLabel('2026-10-23'), 'Mañana');
      expect(clock.dayLabel('2026-10-21'), 'Ayer');
      expect(clock.dayLabel('2026-10-30'), 'vie 30 oct');
    });

    test('hourNow follows the business zone', () {
      final clock = BusinessClock(
        'America/Lima',
        now: () => DateTime.utc(2026, 10, 22, 3, 30),
      );
      expect(clock.hourNow(), 22);
    });

    test('calendar date round-trips through DateTime', () {
      final date = BusinessClock.toCalendarDate('2026-10-22');
      expect(BusinessClock.fromCalendarDate(date), '2026-10-22');
    });
  });
}
