import { getDataSourceToken } from '@nestjs/typeorm';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';

import {
  addStaffUser,
  createAgenda,
  futureLocalDate,
  limaInstant,
  type Agenda,
} from './support/agenda-fixtures.js';
import { API, authHeader, registerBusiness } from './support/auth-flows.js';
import { createTestApp } from './support/create-test-app.js';
import { queryRows, truncateAll } from './support/test-data-source.js';

describe('Appointments (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let agenda: Agenda;

  const server = () => app.getHttpServer();

  const book = (
    at: string,
    overrides: Record<string, unknown> = {},
    token = agenda.owner,
  ) =>
    request(server())
      .post(`${API}/appointments`)
      .set(...authHeader(token))
      .send({
        clientId: agenda.clientId,
        serviceId: agenda.serviceId,
        staffMemberId: agenda.staffMemberId,
        startAt: limaInstant(agenda.monday, at),
        ...overrides,
      });

  const act = (
    id: string,
    action: string,
    body: object = {},
    token = agenda.owner,
  ) =>
    request(server())
      .post(`${API}/appointments/${id}/${action}`)
      .set(...authHeader(token))
      .send(body);

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());
    await dataSource.runMigrations({ transaction: 'all' });
  }, 90_000);

  beforeEach(async () => {
    await truncateAll(dataSource);
    agenda = await createAgenda(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('booking', () => {
    it('books with the price and duration frozen from the service', async () => {
      const response = await book('10:00').expect(201);

      expect(response.body.data).toMatchObject({
        status: 'PENDING',
        startAt: limaInstant(agenda.monday, '10:00'),
        endAt: limaInstant(agenda.monday, '10:30'),
        price: '25.00',
        source: 'MANUAL',
        client: { id: agenda.clientId, name: 'Juan Pérez' },
        service: { id: agenda.serviceId, name: 'Corte de cabello' },
        staffMember: { id: agenda.staffMemberId, name: 'Carlos' },
      });
    });

    it('keeps the booked price when the service price changes later (rule AP-2)', async () => {
      const booked = await book('10:00').expect(201);

      await request(server())
        .patch(`${API}/services/${agenda.serviceId}`)
        .set(...authHeader(agenda.owner))
        .send({ price: '40.00', durationMinutes: 60 })
        .expect(200);

      const detail = await request(server())
        .get(`${API}/appointments/${booked.body.data.id}`)
        .set(...authHeader(agenda.owner))
        .expect(200);

      expect(detail.body.data.price).toBe('25.00');
      expect(detail.body.data.endAt).toBe(limaInstant(agenda.monday, '10:30'));
    });

    it('can be booked already confirmed', async () => {
      const response = await book('10:00', { status: 'CONFIRMED' }).expect(201);

      expect(response.body.data.status).toBe('CONFIRMED');
    });

    it('rejects an overlapping appointment for the same barber (rule AP-3)', async () => {
      const first = await book('10:00').expect(201);

      const clash = await book('10:15').expect(409);

      expect(clash.body.code).toBe('APPOINTMENT_OVERLAP');
      expect(clash.body.details).toEqual({
        conflictingAppointmentId: first.body.data.id,
      });
    });

    it('accepts back-to-back appointments', async () => {
      await book('10:00').expect(201);
      await book('10:30').expect(201);
    });

    it('frees the slot when the first appointment is cancelled', async () => {
      const first = await book('10:00').expect(201);
      await act(first.body.data.id as string, 'cancel').expect(200);

      await book('10:00').expect(201);
    });

    it.each([
      ['during the lunch break', '13:15', 'OUTSIDE_STAFF_SCHEDULE'],
      ['running into the lunch break', '12:45', 'OUTSIDE_STAFF_SCHEDULE'],
      ['before opening', '08:00', 'OUTSIDE_STAFF_SCHEDULE'],
    ])('rejects a booking %s', async (_case, time, code) => {
      const response = await book(time).expect(422);

      expect(response.body.code).toBe(code);
    });

    it('rejects Sunday, a day with no working hours', async () => {
      const response = await book('10:00', {
        startAt: limaInstant(futureLocalDate(7), '10:00'),
      }).expect(422);

      expect(response.body.code).toBe('OUTSIDE_STAFF_SCHEDULE');
    });

    it('rejects a booking during time off', async () => {
      await request(server())
        .post(`${API}/staff/${agenda.staffMemberId}/time-off`)
        .set(...authHeader(agenda.owner))
        .send({
          startsAt: limaInstant(agenda.monday, '09:00'),
          endsAt: limaInstant(agenda.monday, '13:00'),
          reason: 'Médico',
        })
        .expect(201);

      const response = await book('10:00').expect(422);

      expect(response.body.code).toBe('STAFF_ON_TIME_OFF');
    });

    it('lets an OWNER book outside the schedule on purpose, but never over another appointment', async () => {
      await book('13:15', { allowOutsideSchedule: true }).expect(201);

      const clash = await book('13:30', { allowOutsideSchedule: true }).expect(
        409,
      );

      expect(clash.body.code).toBe('APPOINTMENT_OVERLAP');
    });

    it('rejects a booking in the past unless the schedule is overridden', async () => {
      const lastWeek = limaInstant(futureLocalDate(1, -1), '10:00');

      const rejected = await book('10:00', { startAt: lastWeek }).expect(422);
      expect(rejected.body.code).toBe('APPOINTMENT_IN_THE_PAST');

      await book('10:00', {
        startAt: lastWeek,
        allowOutsideSchedule: true,
      }).expect(201);
    });

    it('rejects an inactive service (rule CA-4)', async () => {
      await request(server())
        .post(`${API}/services/${agenda.serviceId}/deactivate`)
        .set(...authHeader(agenda.owner))
        .expect(200);

      const response = await book('10:00').expect(422);

      expect(response.body.code).toBe('SERVICE_NOT_BOOKABLE');
    });

    it('rejects a deleted client', async () => {
      await request(server())
        .delete(`${API}/clients/${agenda.clientId}`)
        .set(...authHeader(agenda.owner))
        .expect(204);

      const response = await book('10:00').expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });
  });

  describe('concurrency (rule AP-5)', () => {
    it('lets exactly one of many simultaneous requests take the same slot', async () => {
      const attempts = 10;

      const responses = await Promise.all(
        Array.from({ length: attempts }, () => book('11:00')),
      );

      const statuses = responses.map((response) => response.status).sort();

      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status) => status === 409)).toHaveLength(
        attempts - 1,
      );

      const rows = await queryRows<{ total: number }>(
        dataSource,
        'SELECT COUNT(*) AS total FROM appointments WHERE staff_member_id = ?',
        [agenda.staffMemberId],
      );

      expect(Number(rows[0].total)).toBe(1);
    });

    it('does not make different barbers wait for each other', async () => {
      const second = await request(server())
        .post(`${API}/staff`)
        .set(...authHeader(agenda.owner))
        .send({ displayName: 'Ana' })
        .expect(201);

      await request(server())
        .put(`${API}/staff/${second.body.data.id}/schedule`)
        .set(...authHeader(agenda.owner))
        .send({ ranges: [{ weekday: 1, startsAt: '09:00', endsAt: '13:00' }] })
        .expect(200);

      const [a, b] = await Promise.all([
        book('11:00'),
        book('11:00', { staffMemberId: second.body.data.id }),
      ]);

      expect([a.status, b.status]).toEqual([201, 201]);
    });
  });

  describe('lifecycle', () => {
    it('walks the full happy path and records every step', async () => {
      const booked = await book('10:00').expect(201);
      const id = booked.body.data.id as string;

      for (const [action, status] of [
        ['confirm', 'CONFIRMED'],
        ['arrive', 'ARRIVED'],
        ['start', 'IN_PROGRESS'],
        ['complete', 'COMPLETED'],
      ]) {
        const response = await act(id, action).expect(200);
        expect(response.body.data.status).toBe(status);
      }

      const detail = await request(server())
        .get(`${API}/appointments/${id}`)
        .set(...authHeader(agenda.owner))
        .expect(200);

      expect(
        (detail.body.data.history as { toStatus: string }[]).map(
          (change) => change.toStatus,
        ),
      ).toEqual([
        'PENDING',
        'CONFIRMED',
        'ARRIVED',
        'IN_PROGRESS',
        'COMPLETED',
      ]);
      expect(detail.body.data.history[1].changedByUserId).toBe(
        agenda.owner.userId,
      );
      expect(detail.body.data.completedAt).toEqual(expect.any(String));
    });

    it('completes in one tap from pending (decision F9)', async () => {
      const booked = await book('10:00').expect(201);

      const response = await act(
        booked.body.data.id as string,
        'complete',
      ).expect(200);

      expect(response.body.data.status).toBe('COMPLETED');
    });

    it('refuses an illegal transition', async () => {
      const booked = await book('10:00').expect(201);
      const id = booked.body.data.id as string;
      await act(id, 'cancel').expect(200);

      const response = await act(id, 'confirm').expect(422);

      expect(response.body.code).toBe('INVALID_APPOINTMENT_TRANSITION');
      expect(response.body.details).toEqual({
        from: 'CANCELLED',
        to: 'CONFIRMED',
      });
    });

    it('requires a reason to cancel a service in progress', async () => {
      const booked = await book('10:00').expect(201);
      const id = booked.body.data.id as string;
      await act(id, 'start').expect(200);

      const missing = await act(id, 'cancel').expect(400);
      expect(missing.body.code).toBe('CANCELLATION_REASON_REQUIRED');

      const done = await act(id, 'cancel', { reason: 'Corte de luz' }).expect(
        200,
      );
      expect(done.body.data.cancellationReason).toBe('Corte de luz');
    });

    it('refuses a no-show before the appointment starts', async () => {
      const booked = await book('10:00').expect(201);

      const response = await act(
        booked.body.data.id as string,
        'no-show',
      ).expect(422);

      expect(response.body.code).toBe('NO_SHOW_BEFORE_START');
    });

    it('re-checks the slot when a no-show turns into a completed visit', async () => {
      // Recorded in the past on purpose, so the no-show is allowed.
      const past = limaInstant(futureLocalDate(1, -1), '10:00');
      const missed = await book('10:00', {
        startAt: past,
        allowOutsideSchedule: true,
      }).expect(201);
      const missedId = missed.body.data.id as string;
      await act(missedId, 'no-show').expect(200);

      // The freed slot went to a walk-in…
      await book('10:00', { startAt: past, allowOutsideSchedule: true }).expect(
        201,
      );

      // …so the late client cannot be recorded on top of it.
      const response = await act(missedId, 'complete').expect(409);

      expect(response.body.code).toBe('APPOINTMENT_OVERLAP');
    });
  });

  describe('reschedule', () => {
    it('moves an appointment keeping its duration and price', async () => {
      const booked = await book('10:00').expect(201);

      const response = await request(server())
        .patch(`${API}/appointments/${booked.body.data.id}`)
        .set(...authHeader(agenda.owner))
        .send({
          startAt: limaInstant(agenda.monday, '16:00'),
          notes: 'Llega tarde',
        })
        .expect(200);

      expect(response.body.data).toMatchObject({
        startAt: limaInstant(agenda.monday, '16:00'),
        endAt: limaInstant(agenda.monday, '16:30'),
        price: '25.00',
        notes: 'Llega tarde',
      });
    });

    it('may move within its own current slot without clashing with itself', async () => {
      const booked = await book('10:00').expect(201);

      await request(server())
        .patch(`${API}/appointments/${booked.body.data.id}`)
        .set(...authHeader(agenda.owner))
        .send({ startAt: limaInstant(agenda.monday, '10:15') })
        .expect(200);
    });

    it('rejects moving onto another appointment', async () => {
      await book('11:00').expect(201);
      const other = await book('10:00').expect(201);

      const response = await request(server())
        .patch(`${API}/appointments/${other.body.data.id}`)
        .set(...authHeader(agenda.owner))
        .send({ startAt: limaInstant(agenda.monday, '11:00') })
        .expect(409);

      expect(response.body.code).toBe('APPOINTMENT_OVERLAP');
    });

    it('refuses to move a completed appointment', async () => {
      const booked = await book('10:00').expect(201);
      await act(booked.body.data.id as string, 'complete').expect(200);

      const response = await request(server())
        .patch(`${API}/appointments/${booked.body.data.id}`)
        .set(...authHeader(agenda.owner))
        .send({ startAt: limaInstant(agenda.monday, '16:00') })
        .expect(422);

      expect(response.body.code).toBe('APPOINTMENT_NOT_RESCHEDULABLE');
    });
  });

  describe('agenda and availability', () => {
    it('lists the day in order, with names', async () => {
      await book('16:00').expect(201);
      await book('10:00').expect(201);

      const response = await request(server())
        .get(`${API}/appointments`)
        .query({
          from: limaInstant(agenda.monday, '00:00'),
          to: limaInstant(futureLocalDate(2), '00:00'),
        })
        .set(...authHeader(agenda.owner))
        .expect(200);

      expect(
        (response.body.data as { startAt: string }[]).map((a) => a.startAt),
      ).toEqual([
        limaInstant(agenda.monday, '10:00'),
        limaInstant(agenda.monday, '16:00'),
      ]);
      expect(response.body.data[0].client.name).toBe('Juan Pérez');
    });

    it('refuses an agenda query wider than 62 days', async () => {
      const response = await request(server())
        .get(`${API}/appointments`)
        .query({
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-06-01T00:00:00.000Z',
        })
        .set(...authHeader(agenda.owner))
        .expect(400);

      expect(response.body.code).toBe('AGENDA_RANGE_TOO_WIDE');
    });

    it('offers free slots, skipping the lunch break and booked times', async () => {
      await book('10:00').expect(201);

      const response = await request(server())
        .get(`${API}/appointments/availability`)
        .query({
          staffMemberId: agenda.staffMemberId,
          serviceId: agenda.serviceId,
          date: agenda.monday,
        })
        .set(...authHeader(agenda.owner))
        .expect(200);

      const times = (response.body.data.slots as { localTime: string }[]).map(
        (slot) => slot.localTime,
      );

      expect(response.body.data.timezone).toBe('America/Lima');
      expect(times[0]).toBe('09:00');
      // 09:45 would run into the 10:00 booking; 10:15 overlaps it.
      expect(times).toContain('09:30');
      expect(times).not.toContain('09:45');
      expect(times).not.toContain('10:15');
      expect(times).toContain('10:30');
      // Lunch break: nothing that ends after 13:00 or starts before 15:00.
      expect(times).not.toContain('12:45');
      expect(times).not.toContain('14:00');
      expect(times).toContain('15:00');
      expect(times.at(-1)).toBe('19:30');
    });
  });

  describe('STAFF scope (docs/permissions.md)', () => {
    it('lets STAFF manage their own agenda', async () => {
      const { staffUser, staffMemberId } = await addStaffUser(
        app,
        agenda.owner,
      );

      const own = await book('10:00', { staffMemberId }, staffUser).expect(201);
      await act(own.body.data.id as string, 'confirm', {}, staffUser).expect(
        200,
      );
    });

    it('forbids STAFF from booking into another barber agenda', async () => {
      const { staffUser } = await addStaffUser(app, agenda.owner);

      const response = await book('10:00', {}, staffUser).expect(403);

      expect(response.body.code).toBe('OWN_AGENDA_ONLY');
    });

    it('hides other barbers appointments from STAFF', async () => {
      const { staffUser } = await addStaffUser(app, agenda.owner);
      const others = await book('10:00').expect(201);

      await request(server())
        .get(`${API}/appointments/${others.body.data.id}`)
        .set(...authHeader(staffUser))
        .expect(404);
      await act(others.body.data.id as string, 'cancel', {}, staffUser).expect(
        404,
      );

      const list = await request(server())
        .get(`${API}/appointments`)
        .query({
          from: limaInstant(agenda.monday, '00:00'),
          to: limaInstant(futureLocalDate(2), '00:00'),
        })
        .set(...authHeader(staffUser))
        .expect(200);

      expect(list.body.meta.total).toBe(0);
    });

    it('forbids STAFF from overriding the schedule', async () => {
      const { staffUser, staffMemberId } = await addStaffUser(
        app,
        agenda.owner,
      );

      const response = await book(
        '13:15',
        { staffMemberId, allowOutsideSchedule: true },
        staffUser,
      ).expect(403);

      expect(response.body.code).toBe('SCHEDULE_OVERRIDE_NOT_ALLOWED');
    });
  });

  describe('tenant isolation', () => {
    it('answers 404 to every operation on another tenant appointment', async () => {
      const booked = await book('10:00').expect(201);
      const id = booked.body.data.id as string;
      const intruder = await registerBusiness(app);

      await request(server())
        .get(`${API}/appointments/${id}`)
        .set(...authHeader(intruder))
        .expect(404);
      await request(server())
        .patch(`${API}/appointments/${id}`)
        .set(...authHeader(intruder))
        .send({ notes: 'hacked' })
        .expect(404);
      await act(id, 'cancel', {}, intruder).expect(404);
    });

    it('cannot book with another tenant client, service or barber', async () => {
      const intruder = await registerBusiness(app);
      const intruderAgenda = await createAgenda(app, intruder);

      // Intruder's own barber and service, but the victim's client id.
      const response = await request(server())
        .post(`${API}/appointments`)
        .set(...authHeader(intruder))
        .send({
          clientId: agenda.clientId,
          serviceId: intruderAgenda.serviceId,
          staffMemberId: intruderAgenda.staffMemberId,
          startAt: limaInstant(agenda.monday, '10:00'),
        })
        .expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('is also enforced by the database itself (ADR 0004, layer 4)', async () => {
      const intruder = await registerBusiness(app);
      const intruderAgenda = await createAgenda(app, intruder);

      // Bypass the application entirely: the composite foreign key refuses an
      // appointment of tenant B that points at tenant A's client.
      await expect(
        dataSource.query(
          `INSERT INTO appointments
             (id, tenant_id, client_id, service_id, staff_member_id, start_at, end_at,
              status, price, source, created_at, updated_at)
           VALUES (UUID(), ?, ?, ?, ?, NOW(3), NOW(3) + INTERVAL 30 MINUTE,
                   'PENDING', 25.00, 'MANUAL', NOW(3), NOW(3))`,
          [
            intruder.tenantId,
            agenda.clientId,
            intruderAgenda.serviceId,
            intruderAgenda.staffMemberId,
          ],
        ),
      ).rejects.toThrow(/foreign key constraint fails/i);
    });
  });
});
