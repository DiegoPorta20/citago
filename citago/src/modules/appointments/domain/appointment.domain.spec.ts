import { BusinessCalendar } from '../../../shared/domain/business-calendar.js';
import { Money } from '../../../shared/domain/money.js';
import { TimeRange } from '../../../shared/domain/time-range.js';
import { StaffTimeOff } from '../../staff/domain/staff-time-off.entity.js';
import { WeeklySchedule } from '../../../shared/domain/weekly-schedule.js';
import {
  AppointmentOverlapError,
  AppointmentSpansDaysError,
  CancellationReasonRequiredError,
  InvalidAppointmentTransitionError,
  NoShowBeforeStartError,
  NotReschedulableError,
  OutsideStaffScheduleError,
  StaffOnTimeOffError,
} from './appointment.errors.js';
import { Appointment } from './appointment.entity.js';
import { AppointmentOverlapPolicy } from './appointment-overlap.policy.js';
import { AppointmentSource } from './appointment-source.js';
import {
  ALLOWED_TRANSITIONS,
  AppointmentStatus,
} from './appointment-status.js';
import { StaffAvailabilityPolicy } from './staff-availability.policy.js';

const S = AppointmentStatus;
const utc = (iso: string) => new Date(iso);
const BOOKED_AT = utc('2026-09-10T12:00:00Z');
// Thursday 2026-09-17, 10:00–10:30 in Lima (UTC-5).
const START = utc('2026-09-17T15:00:00Z');
const END = utc('2026-09-17T15:30:00Z');
const AFTER_START = utc('2026-09-17T16:00:00Z');

let sequence = 0;

function book(
  range = TimeRange.of(START, END),
  initialStatus:
    AppointmentStatus.Pending | AppointmentStatus.Confirmed = S.Pending,
): Appointment {
  sequence += 1;

  return Appointment.book(
    {
      id: `appointment-${sequence}`,
      tenantId: 'tenant-1',
      clientId: 'client-1',
      serviceId: 'service-1',
      staffMemberId: 'staff-1',
      range,
      price: Money.fromDecimalString('25.00'),
      source: AppointmentSource.Manual,
      initialStatus,
      createdByUserId: 'user-1',
    },
    BOOKED_AT,
  );
}

/** Walks an appointment to `status` along a legal path. */
function bookIn(status: AppointmentStatus): Appointment {
  const appointment = book();
  const path: Record<AppointmentStatus, AppointmentStatus[]> = {
    [S.Pending]: [],
    [S.Confirmed]: [S.Confirmed],
    [S.Arrived]: [S.Arrived],
    [S.InProgress]: [S.InProgress],
    [S.Completed]: [S.Completed],
    [S.Cancelled]: [S.Cancelled],
    [S.NoShow]: [S.NoShow],
  };

  for (const step of path[status]) {
    appointment.transitionTo(step, { actorUserId: 'user-1' }, AFTER_START);
  }

  return appointment;
}

describe('Appointment', () => {
  describe('booking', () => {
    it('starts in the requested status and records the creation in history', () => {
      const appointment = book(TimeRange.of(START, END), S.Confirmed);

      expect(appointment.status).toBe(S.Confirmed);
      expect(appointment.pullStatusChanges()).toEqual([
        {
          fromStatus: null,
          toStatus: S.Confirmed,
          reason: null,
          changedByUserId: 'user-1',
          changedAt: BOOKED_AT,
        },
      ]);
    });

    it('keeps the price it was booked with (rule AP-2)', () => {
      expect(book().toSnapshot().price).toBe('25.00');
    });
  });

  describe('state machine (rules AP-6, AP-7)', () => {
    const allStatuses = Object.values(S);
    const pairs = allStatuses.flatMap((from) =>
      allStatuses.map((to) => [from, to] as const),
    );

    it.each(pairs)('%s → %s follows the transition table', (from, to) => {
      const appointment = bookIn(from);
      const allowed = ALLOWED_TRANSITIONS[from].includes(to);
      const move = () =>
        appointment.transitionTo(
          to,
          { actorUserId: 'user-1', reason: 'motivo' },
          AFTER_START,
        );

      if (allowed) {
        expect(move).not.toThrow();
        expect(appointment.status).toBe(to);
      } else {
        expect(move).toThrow(InvalidAppointmentTransitionError);
        expect(appointment.status).toBe(from);
      }
    });

    it('lets a busy barber complete in one tap (decision F9)', () => {
      const appointment = book();

      appointment.transitionTo(S.Completed, { actorUserId: 'u' }, AFTER_START);

      expect(appointment.status).toBe(S.Completed);
      expect(appointment.completedAt).toEqual(AFTER_START);
    });

    it('lets a late client be completed after a no-show (decision F7)', () => {
      const appointment = bookIn(S.NoShow);

      appointment.transitionTo(S.Completed, { actorUserId: 'u' }, AFTER_START);

      expect(appointment.status).toBe(S.Completed);
    });

    it('records who cancelled, when and why', () => {
      const appointment = book();
      appointment.pullStatusChanges();

      appointment.transitionTo(
        S.Cancelled,
        { actorUserId: 'user-9', reason: '  El cliente viajó  ' },
        AFTER_START,
      );

      expect(appointment.cancelledAt).toEqual(AFTER_START);
      expect(appointment.cancellationReason).toBe('El cliente viajó');
      expect(appointment.pullStatusChanges()).toEqual([
        {
          fromStatus: S.Pending,
          toStatus: S.Cancelled,
          reason: 'El cliente viajó',
          changedByUserId: 'user-9',
          changedAt: AFTER_START,
        },
      ]);
    });

    it('requires a reason to cancel a service already in progress', () => {
      const appointment = bookIn(S.InProgress);

      expect(() =>
        appointment.transitionTo(
          S.Cancelled,
          { actorUserId: 'u' },
          AFTER_START,
        ),
      ).toThrow(CancellationReasonRequiredError);
    });

    it('refuses a no-show before the appointment starts', () => {
      const appointment = book();

      expect(() =>
        appointment.transitionTo(
          S.NoShow,
          { actorUserId: 'u' },
          utc('2026-09-17T14:00:00Z'),
        ),
      ).toThrow(NoShowBeforeStartError);
    });

    it('hands each history entry to the repository only once', () => {
      const appointment = book();

      expect(appointment.pullStatusChanges()).toHaveLength(1);
      expect(appointment.pullStatusChanges()).toHaveLength(0);
    });
  });

  describe('blocking statuses (rule AP-4, decision F8)', () => {
    it.each([
      [S.Pending, true],
      [S.Confirmed, true],
      [S.Arrived, true],
      [S.InProgress, true],
      [S.Completed, true],
      [S.Cancelled, false],
      [S.NoShow, false],
    ])('%s blocks the agenda: %s', (status, blocking) => {
      expect(bookIn(status).isBlocking).toBe(blocking);
    });
  });

  describe('reschedule', () => {
    it('moves the appointment keeping its duration', () => {
      const appointment = book();
      const newStart = utc('2026-09-18T16:00:00Z');

      appointment.reschedule({ startAt: newStart }, AFTER_START);

      expect(appointment.range.start).toEqual(newStart);
      expect(appointment.range.end).toEqual(utc('2026-09-18T16:30:00Z'));
    });

    it.each([S.Arrived, S.InProgress, S.Completed, S.Cancelled, S.NoShow])(
      'refuses to reschedule an appointment in %s',
      (status) => {
        expect(() =>
          bookIn(status).reschedule({ staffMemberId: 'staff-2' }, AFTER_START),
        ).toThrow(NotReschedulableError);
      },
    );
  });
});

describe('AppointmentOverlapPolicy (rule AP-3)', () => {
  const at = (from: string, to: string) =>
    TimeRange.of(utc(`2026-09-17T${from}:00Z`), utc(`2026-09-17T${to}:00Z`));

  it('rejects a partial overlap', () => {
    const existing = book(at('10:00', '11:00'));

    expect(() =>
      AppointmentOverlapPolicy.assertNoOverlap(at('10:30', '11:30'), [
        existing,
      ]),
    ).toThrow(AppointmentOverlapError);
  });

  it('accepts back-to-back appointments', () => {
    const existing = book(at('10:00', '11:00'));

    expect(() =>
      AppointmentOverlapPolicy.assertNoOverlap(at('11:00', '12:00'), [
        existing,
      ]),
    ).not.toThrow();
  });

  it.each([S.Cancelled, S.NoShow])('ignores a %s appointment', (status) => {
    const existing = bookIn(status);

    expect(() =>
      AppointmentOverlapPolicy.assertNoOverlap(existing.range, [existing]),
    ).not.toThrow();
  });

  it('still blocks on a completed appointment (decision F8)', () => {
    const existing = bookIn(S.Completed);

    expect(() =>
      AppointmentOverlapPolicy.assertNoOverlap(existing.range, [existing]),
    ).toThrow(AppointmentOverlapError);
  });

  it('ignores the appointment being rescheduled', () => {
    const existing = book(at('10:00', '11:00'));

    expect(() =>
      AppointmentOverlapPolicy.assertNoOverlap(
        at('10:15', '11:15'),
        [existing],
        existing.id,
      ),
    ).not.toThrow();
  });
});

describe('StaffAvailabilityPolicy', () => {
  const lima = new BusinessCalendar('America/Lima');
  // Thursday (4): 09:00–13:00 and 15:00–20:00, a lunch break in between.
  const schedule = WeeklySchedule.fromInput([
    { weekday: 4, startsAt: '09:00', endsAt: '13:00' },
    { weekday: 4, startsAt: '15:00', endsAt: '20:00' },
  ]);
  const local = (time: string) => utc(`2026-09-17T${time}:00-05:00`);
  const range = (from: string, to: string) =>
    TimeRange.of(local(from), local(to));

  describe('assertAvailable', () => {
    it('accepts an appointment inside a working range', () => {
      expect(() =>
        StaffAvailabilityPolicy.assertAvailable(range('10:00', '10:30'), {
          calendar: lima,
          schedule,
          timeOff: [],
        }),
      ).not.toThrow();
    });

    it('accepts an appointment that ends exactly at closing time', () => {
      expect(() =>
        StaffAvailabilityPolicy.assertAvailable(range('12:30', '13:00'), {
          calendar: lima,
          schedule,
          timeOff: [],
        }),
      ).not.toThrow();
    });

    it('rejects one that runs into the lunch break', () => {
      expect(() =>
        StaffAvailabilityPolicy.assertAvailable(range('12:45', '13:15'), {
          calendar: lima,
          schedule,
          timeOff: [],
        }),
      ).toThrow(OutsideStaffScheduleError);
    });

    it('rejects a day off', () => {
      // Friday has no range at all.
      expect(() =>
        StaffAvailabilityPolicy.assertAvailable(
          TimeRange.of(
            utc('2026-09-18T10:00:00-05:00'),
            utc('2026-09-18T10:30:00-05:00'),
          ),
          { calendar: lima, schedule, timeOff: [] },
        ),
      ).toThrow(OutsideStaffScheduleError);
    });

    it('rejects an appointment during time off', () => {
      const timeOff = StaffTimeOff.create(
        {
          id: 'off-1',
          tenantId: 'tenant-1',
          staffMemberId: 'staff-1',
          startsAt: local('10:00'),
          endsAt: local('11:00'),
        },
        BOOKED_AT,
      );

      expect(() =>
        StaffAvailabilityPolicy.assertAvailable(range('10:30', '11:00'), {
          calendar: lima,
          schedule,
          timeOff: [timeOff],
        }),
      ).toThrow(StaffOnTimeOffError);
    });

    it('rejects an appointment crossing local midnight', () => {
      expect(() =>
        StaffAvailabilityPolicy.assertAvailable(
          TimeRange.of(
            utc('2026-09-17T23:30:00-05:00'),
            utc('2026-09-18T00:15:00-05:00'),
          ),
          { calendar: lima, schedule, timeOff: [] },
        ),
      ).toThrow(AppointmentSpansDaysError);
    });

    it('evaluates the schedule in the business time zone, not UTC', () => {
      // 19:30 in Lima is already Friday in UTC. It is still Thursday's shift.
      expect(() =>
        StaffAvailabilityPolicy.assertAvailable(range('19:30', '20:00'), {
          calendar: lima,
          schedule,
          timeOff: [],
        }),
      ).not.toThrow();
    });
  });

  describe('freeSlots', () => {
    const base = {
      calendar: lima,
      schedule,
      localDate: '2026-09-17',
      durationMinutes: 30,
      stepMinutes: 30,
      notBefore: utc('2026-09-17T00:00:00-05:00'),
    };

    it('offers every slot of both working ranges', () => {
      const slots = StaffAvailabilityPolicy.freeSlots({
        ...base,
        busy: [],
        timeOff: [],
      });

      // 09:00–13:00 → 8 slots; 15:00–20:00 → 10 slots.
      expect(slots).toHaveLength(18);
      expect(slots[0].startAt).toEqual(local('09:00'));
      expect(slots.at(-1)?.startAt).toEqual(local('19:30'));
    });

    it('skips busy times, time off and the past', () => {
      const timeOff = StaffTimeOff.create(
        {
          id: 'off-1',
          tenantId: 'tenant-1',
          staffMemberId: 'staff-1',
          startsAt: local('15:00'),
          endsAt: local('20:00'),
        },
        BOOKED_AT,
      );

      const slots = StaffAvailabilityPolicy.freeSlots({
        ...base,
        notBefore: local('10:00'),
        busy: [range('11:00', '11:30')],
        timeOff: [timeOff],
      });

      expect(slots.map((slot) => lima.localTimeOf(slot.startAt))).toEqual([
        '10:00',
        '10:30',
        '11:30',
        '12:00',
        '12:30',
      ]);
    });

    it('offers nothing on a day off', () => {
      expect(
        StaffAvailabilityPolicy.freeSlots({
          ...base,
          localDate: '2026-09-18',
          busy: [],
          timeOff: [],
        }),
      ).toEqual([]);
    });

    it('never offers a slot that would run past the end of a range', () => {
      const slots = StaffAvailabilityPolicy.freeSlots({
        ...base,
        durationMinutes: 45,
        busy: [],
        timeOff: [],
      });

      for (const slot of slots) {
        const endsLocal = lima.localTimeOf(slot.endAt);
        expect(endsLocal <= '13:00' || endsLocal >= '15:00').toBe(true);
        expect(endsLocal <= '20:00').toBe(true);
      }
    });
  });
});
