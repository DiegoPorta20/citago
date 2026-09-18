import {
  BusinessCalendar,
  InvalidLocalDateError,
} from './business-calendar.js';
import { InvalidTimeOfDayError, TimeOfDay } from './time-of-day.js';
import { InvalidTimeRangeError, TimeRange } from './time-range.js';

const at = (iso: string) => new Date(iso);

describe('TimeOfDay', () => {
  it.each([
    ['09:00', 540],
    ['00:00', 0],
    ['23:59', 1439],
    ['13:30:00', 810],
  ])('parses %s', (value, minutes) => {
    expect(TimeOfDay.parse(value).minutes).toBe(minutes);
  });

  it.each(['24:00', '9:00', '09:60', 'nueve', '09:00:30'])(
    'rejects %s',
    (value) => {
      expect(() => TimeOfDay.parse(value)).toThrow(InvalidTimeOfDayError);
    },
  );

  it('formats as HH:mm', () => {
    expect(TimeOfDay.parse('07:05').toString()).toBe('07:05');
  });
});

describe('TimeRange', () => {
  const range = (from: string, to: string) =>
    TimeRange.of(at(`2026-09-17T${from}:00Z`), at(`2026-09-17T${to}:00Z`));

  it('detects an overlap', () => {
    expect(range('10:00', '11:00').overlaps(range('10:30', '11:30'))).toBe(
      true,
    );
  });

  it('does not treat back-to-back ranges as overlapping (rule AP-3)', () => {
    expect(range('10:00', '11:00').overlaps(range('11:00', '12:00'))).toBe(
      false,
    );
  });

  it('detects containment, including exact fits', () => {
    expect(range('09:00', '13:00').contains(range('09:00', '13:00'))).toBe(
      true,
    );
    expect(range('09:00', '13:00').contains(range('12:30', '13:30'))).toBe(
      false,
    );
  });

  it('rejects an empty or inverted range', () => {
    expect(() => range('10:00', '10:00')).toThrow(InvalidTimeRangeError);
    expect(() => range('11:00', '10:00')).toThrow(InvalidTimeRangeError);
  });
});

describe('BusinessCalendar', () => {
  const lima = new BusinessCalendar('America/Lima');
  const madrid = new BusinessCalendar('Europe/Madrid');

  it('places a wall-clock time on the right instant', () => {
    // Lima is UTC-5 all year.
    expect(lima.instantAt('2026-09-17', TimeOfDay.parse('09:00'))).toEqual(
      at('2026-09-17T14:00:00Z'),
    );
  });

  it('keeps 09:00 at 09:00 across a daylight-saving change', () => {
    // Madrid moves from UTC+1 to UTC+2 on 2026-03-29.
    expect(madrid.instantAt('2026-03-28', TimeOfDay.parse('09:00'))).toEqual(
      at('2026-03-28T08:00:00Z'),
    );
    expect(madrid.instantAt('2026-03-29', TimeOfDay.parse('09:00'))).toEqual(
      at('2026-03-29T07:00:00Z'),
    );
  });

  it('knows a DST day is not 24 hours long', () => {
    expect(madrid.dayRange('2026-03-29').durationMinutes).toBe(23 * 60);
    expect(madrid.dayRange('2026-10-25').durationMinutes).toBe(25 * 60);
  });

  it('reads the local date of an instant, not the UTC one', () => {
    // 02:00 UTC is still the previous evening in Lima.
    expect(lima.localDateOf(at('2026-09-18T02:00:00Z'))).toBe('2026-09-17');
    expect(lima.localTimeOf(at('2026-09-18T02:00:00Z'))).toBe('21:00');
  });

  it('computes the ISO weekday of a local date', () => {
    expect(lima.weekdayOf('2026-09-17')).toBe(4); // Thursday
    expect(lima.weekdayOf('2026-09-20')).toBe(7); // Sunday
  });

  it.each(['2026-02-30', '17/09/2026', 'mañana'])(
    'rejects the impossible date %s',
    (value) => {
      expect(() => lima.weekdayOf(value)).toThrow(InvalidLocalDateError);
    },
  );
});
