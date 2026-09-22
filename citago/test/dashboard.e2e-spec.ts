import { getDataSourceToken } from '@nestjs/typeorm';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DateTime } from 'luxon';
import request from 'supertest';
import type { DataSource } from 'typeorm';

import {
  addStaffUser,
  createAgenda,
  limaInstant,
  type Agenda,
} from './support/agenda-fixtures.js';
import {
  API,
  authHeader,
  registerBusiness,
  type RegisteredBusiness,
} from './support/auth-flows.js';
import { createTestApp } from './support/create-test-app.js';
import { truncateAll } from './support/test-data-source.js';

const LIMA = 'America/Lima';

describe('Dashboard (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let agenda: Agenda;

  const server = () => app.getHttpServer();
  const today = () => DateTime.now().setZone(LIMA).toISODate() as string;

  const summary = (
    query: Record<string, string> = {},
    token: RegisteredBusiness = agenda.owner,
  ) =>
    request(server())
      .get(`${API}/dashboard/summary`)
      .query(query)
      .set(...authHeader(token));

  const mine = (
    query: Record<string, string> = {},
    token: RegisteredBusiness = agenda.owner,
  ) =>
    request(server())
      .get(`${API}/dashboard/me`)
      .query(query)
      .set(...authHeader(token));

  /** A completed appointment plus the sale that charged it. */
  const completedAndCharged = async (time = '10:00'): Promise<void> => {
    const booked = await request(server())
      .post(`${API}/appointments`)
      .set(...authHeader(agenda.owner))
      .send({
        clientId: agenda.clientId,
        serviceId: agenda.serviceId,
        staffMemberId: agenda.staffMemberId,
        startAt: limaInstant(agenda.monday, time),
      })
      .expect(201);

    const appointmentId = booked.body.data.id as string;

    await request(server())
      .post(`${API}/appointments/${appointmentId}/complete`)
      .set(...authHeader(agenda.owner))
      .send({})
      .expect(200);

    await request(server())
      .post(`${API}/sales`)
      .set(...authHeader(agenda.owner))
      .send({ appointmentId, paymentMethod: 'CASH' })
      .expect(201);
  };

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

  describe('business summary', () => {
    it('answers with an empty but complete shape when nothing happened', async () => {
      const response = await summary().expect(200);

      expect(response.body.data).toMatchObject({
        period: { from: today(), to: today(), timezone: LIMA },
        currency: 'PEN',
        revenue: { paid: '0.00', paidCount: 0, pending: '0.00' },
        appointments: { total: 0, completed: 0, cancelled: 0, noShow: 0 },
        clients: { created: 1 },
        topServices: [],
      });
    });

    it('adds up revenue, agenda and best sellers over the period', async () => {
      await completedAndCharged('10:00');
      await completedAndCharged('11:00');

      const response = await summary({
        from: today(),
        to: agenda.monday,
      }).expect(200);

      const data = response.body.data;

      expect(data.revenue).toMatchObject({ paid: '50.00', paidCount: 2 });
      expect(data.revenue.byPaymentMethod).toEqual([
        { method: 'CASH', total: '50.00', count: 2 },
      ]);
      expect(data.appointments).toMatchObject({ total: 2, completed: 2 });
      expect(data.topServices[0]).toMatchObject({
        description: 'Corte de cabello',
        quantity: 2,
        total: '50.00',
      });
      expect(data.staff[0]).toMatchObject({
        name: 'Carlos',
        completedAppointments: 2,
        revenue: '50.00',
        saleCount: 2,
      });
    });

    it('leaves a refunded sale out of the revenue (rule SA-5)', async () => {
      await completedAndCharged();

      const sales = await request(server())
        .get(`${API}/sales`)
        .query({
          from: new Date(Date.now() - 86_400_000).toISOString(),
          to: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .set(...authHeader(agenda.owner))
        .expect(200);

      await request(server())
        .post(`${API}/sales/${sales.body.data[0].id}/refund`)
        .set(...authHeader(agenda.owner))
        .send({ reason: 'Cliente insatisfecho' })
        .expect(200);

      const response = await summary({
        from: today(),
        to: agenda.monday,
      }).expect(200);

      expect(response.body.data.revenue).toMatchObject({
        paid: '0.00',
        paidCount: 0,
        refunded: '25.00',
        refundedCount: 1,
      });
    });

    it('rejects a period that is not a date, inverted, or longer than a year', async () => {
      await summary({ from: 'ayer' }).expect(400);
      await summary({ from: '2026-09-30', to: '2026-09-01' }).expect(400);

      const tooWide = await summary({
        from: '2024-01-01',
        to: '2026-01-01',
      }).expect(400);

      expect(tooWide.body.code).toBe('DASHBOARD_RANGE_TOO_WIDE');
    });
  });

  describe('authorization (docs/permissions.md)', () => {
    it('never shows the money of the business to a STAFF user', async () => {
      const { staffUser } = await addStaffUser(app, agenda.owner);

      await summary({}, staffUser).expect(403);
    });

    it('gives every member their own attentions', async () => {
      const { staffUser, staffMemberId } = await addStaffUser(
        app,
        agenda.owner,
      );

      const booked = await request(server())
        .post(`${API}/appointments`)
        .set(...authHeader(agenda.owner))
        .send({
          clientId: agenda.clientId,
          serviceId: agenda.serviceId,
          staffMemberId,
          startAt: limaInstant(agenda.monday, '12:00'),
        })
        .expect(201);

      await request(server())
        .post(`${API}/appointments/${booked.body.data.id}/complete`)
        .set(...authHeader(agenda.owner))
        .send({})
        .expect(200);

      const own = await mine(
        { from: agenda.monday, to: agenda.monday },
        staffUser,
      ).expect(200);

      expect(own.body.data).toMatchObject({
        staffMemberId,
        appointments: { total: 1, completed: 1 },
      });
      expect(own.body.data.revenue).toBeUndefined();
    });

    it('shows nothing rather than everything to an account with no staff member', async () => {
      await completedAndCharged();

      const response = await mine({
        from: agenda.monday,
        to: agenda.monday,
      }).expect(200);

      // The OWNER of this fixture is not linked to a staff member.
      expect(response.body.data.staffMemberId).toBeNull();
      expect(response.body.data.appointments.total).toBe(0);
    });
  });

  describe('tenant isolation (ADR 0004)', () => {
    it("never counts another business's day", async () => {
      await completedAndCharged();
      const other = await registerBusiness(app);

      const response = await request(server())
        .get(`${API}/dashboard/summary`)
        .query({ from: today(), to: agenda.monday })
        .set(...authHeader(other))
        .expect(200);

      expect(response.body.data.revenue.paid).toBe('0.00');
      expect(response.body.data.appointments.total).toBe(0);
      expect(response.body.data.staff).toEqual([]);
    });
  });
});
