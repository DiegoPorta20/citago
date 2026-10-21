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
}
