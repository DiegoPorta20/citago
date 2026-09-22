import { getDataSourceToken } from '@nestjs/typeorm';
import type { NestExpressApplication } from '@nestjs/platform-express';
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

describe('Sales (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let agenda: Agenda;

  const server = () => app.getHttpServer();

  const sell = (body: object, token: RegisteredBusiness = agenda.owner) =>
    request(server())
      .post(`${API}/sales`)
      .set(...authHeader(token))
      .send(body);

  const act = (
    id: string,
    action: string,
    body: object = {},
    token: RegisteredBusiness = agenda.owner,
  ) =>
    request(server())
      .post(`${API}/sales/${id}/${action}`)
      .set(...authHeader(token))
      .send(body);

  /** Books an appointment at `time` and walks it to COMPLETED. */
  const completedAppointment = async (time = '10:00'): Promise<string> => {
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

    const id = booked.body.data.id as string;

    await request(server())
      .post(`${API}/appointments/${id}/complete`)
      .set(...authHeader(agenda.owner))
      .send({})
      .expect(200);

    return id;
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

  describe('charging an appointment', () => {
    it('bills it at the price agreed when booking, in the tenant currency', async () => {
      const appointmentId = await completedAppointment();

      const response = await sell({
        appointmentId,
        paymentMethod: 'CASH',
      }).expect(201);

      expect(response.body.data).toMatchObject({
        status: 'PAID',
        currency: 'PEN',
        subtotal: '25.00',
        discount: '0.00',
        total: '25.00',
        paymentMethod: 'CASH',
        appointmentId,
        client: { id: agenda.clientId, name: 'Juan Pérez' },
        staffMember: { id: agenda.staffMemberId, name: 'Carlos' },
      });
      expect(response.body.data.lines).toHaveLength(1);
      expect(response.body.data.lines[0]).toMatchObject({
        description: 'Corte de cabello',
        unitPrice: '25.00',
        quantity: 1,
        lineTotal: '25.00',
      });
    });

    it('refuses an appointment that was not completed (rules SA-3, AP-9)', async () => {
      const booked = await request(server())
        .post(`${API}/appointments`)
        .set(...authHeader(agenda.owner))
        .send({
          clientId: agenda.clientId,
          serviceId: agenda.serviceId,
          staffMemberId: agenda.staffMemberId,
          startAt: limaInstant(agenda.monday, '11:00'),
        })
        .expect(201);

      const response = await sell({
        appointmentId: booked.body.data.id,
      }).expect(422);

      expect(response.body.code).toBe('APPOINTMENT_NOT_BILLABLE');
    });

    it('refuses to charge the same appointment twice (rule SA-3)', async () => {
      const appointmentId = await completedAppointment();

      const first = await sell({ appointmentId }).expect(201);
      const second = await sell({ appointmentId }).expect(409);

      expect(second.body.code).toBe('APPOINTMENT_ALREADY_BILLED');
      expect(second.body.details).toMatchObject({
        saleId: first.body.data.id,
      });
    });

    it('still charges a service whose price changed afterwards (rule AP-2)', async () => {
      const appointmentId = await completedAppointment();

      await request(server())
        .patch(`${API}/services/${agenda.serviceId}`)
        .set(...authHeader(agenda.owner))
        .send({ price: '40.00' })
        .expect(200);

      const response = await sell({ appointmentId }).expect(201);

      expect(response.body.data.total).toBe('25.00');
    });
  });

  describe('counter sales', () => {
    it('adds up the lines and applies the discount (rule SA-2)', async () => {
      const response = await sell({
        clientId: agenda.clientId,
        staffMemberId: agenda.staffMemberId,
        lines: [
          { serviceId: agenda.serviceId, quantity: 2 },
          { description: 'Cera moldeadora', unitPrice: '18.50' },
        ],
        discount: '3.50',
      }).expect(201);

      expect(response.body.data).toMatchObject({
        status: 'PENDING',
        subtotal: '68.50',
        discount: '3.50',
        total: '65.00',
        appointmentId: null,
      });
    });

    it('rejects a discount larger than the subtotal', async () => {
      const response = await sell({
        lines: [{ description: 'Cera', unitPrice: '10.00' }],
        discount: '10.01',
      }).expect(422);

      expect(response.body.code).toBe('DISCOUNT_ABOVE_SUBTOTAL');
    });

    it('rejects a line with neither service nor price', async () => {
      await sell({ lines: [{ description: 'Algo' }] }).expect(400);
    });

    it('rejects a sale with no lines and no appointment', async () => {
      await sell({ clientId: agenda.clientId }).expect(400);
    });

    it('rejects an amount sent as a JSON number', async () => {
      await sell({
        lines: [{ description: 'Cera', unitPrice: 18.5 }],
      }).expect(400);
    });

    it('never takes a service from another tenant', async () => {
      const other = await registerBusiness(app);
      const foreign = await request(server())
        .post(`${API}/services`)
        .set(...authHeader(other))
        .send({ name: 'Afeitado', durationMinutes: 20, price: '15.00' })
        .expect(201);

      const response = await sell({
        lines: [{ serviceId: foreign.body.data.id }],
      }).expect(404);

      expect(response.body.code).toBe('SERVICE_NOT_FOUND');
    });
  });

  describe('lifecycle (rule SA-4)', () => {
    const pendingSale = async (): Promise<string> => {
      const response = await sell({
        lines: [{ serviceId: agenda.serviceId }],
      }).expect(201);

      return response.body.data.id as string;
    };

    it('charges a pending sale', async () => {
      const id = await pendingSale();

      const response = await act(id, 'pay', { paymentMethod: 'CARD' }).expect(
        200,
      );

      expect(response.body.data).toMatchObject({
        status: 'PAID',
        paymentMethod: 'CARD',
      });
      expect(response.body.data.paidAt).toEqual(expect.any(String));
    });

    it('cancels a pending sale with a reason and an author', async () => {
      const id = await pendingSale();

      const response = await act(id, 'cancel', {
        reason: 'Cobrada por error',
      }).expect(200);

      expect(response.body.data).toMatchObject({
        status: 'CANCELLED',
        voidReason: 'Cobrada por error',
      });
    });

    it('refunds a paid sale, and never cancels it', async () => {
      const id = await pendingSale();

      await act(id, 'pay', { paymentMethod: 'CASH' }).expect(200);

      const cancelled = await act(id, 'cancel', { reason: 'Error' }).expect(
        422,
      );

      expect(cancelled.body.code).toBe('INVALID_SALE_TRANSITION');

      const refunded = await act(id, 'refund', {
        reason: 'Cliente insatisfecho',
      }).expect(200);

      expect(refunded.body.data.status).toBe('REFUNDED');
    });

    it('requires a reason to void', async () => {
      const id = await pendingSale();

      await act(id, 'cancel', {}).expect(400);
      await act(id, 'cancel', { reason: '' }).expect(400);
    });

    it('leaves a voided sale terminal', async () => {
      const id = await pendingSale();

      await act(id, 'cancel', { reason: 'Error' }).expect(200);
      await act(id, 'pay', { paymentMethod: 'CASH' }).expect(422);
    });

    it('offers no way to edit or delete a sale', async () => {
      const id = await pendingSale();

      await request(server())
        .patch(`${API}/sales/${id}`)
        .set(...authHeader(agenda.owner))
        .send({ discount: '5.00' })
        .expect(404);

      await request(server())
        .delete(`${API}/sales/${id}`)
        .set(...authHeader(agenda.owner))
        .expect(404);
    });
  });

  describe('listing', () => {
    const range = {
      from: new Date(Date.now() - 86_400_000).toISOString(),
      to: new Date(Date.now() + 86_400_000).toISOString(),
    };

    it('returns the sales of the range with their pagination meta', async () => {
      await sell({ lines: [{ serviceId: agenda.serviceId }] }).expect(201);
      await sell({
        lines: [{ description: 'Cera', unitPrice: '18.50' }],
        paymentMethod: 'CASH',
      }).expect(201);

      const response = await request(server())
        .get(`${API}/sales`)
        .query(range)
        .set(...authHeader(agenda.owner))
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toMatchObject({ total: 2, page: 1 });
    });

    it('filters by status', async () => {
      await sell({ lines: [{ serviceId: agenda.serviceId }] }).expect(201);
      await sell({
        lines: [{ description: 'Cera', unitPrice: '18.50' }],
        paymentMethod: 'CASH',
      }).expect(201);

      const response = await request(server())
        .get(`${API}/sales`)
        .query({ ...range, status: 'PAID' })
        .set(...authHeader(agenda.owner))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('PAID');
    });

    it('rejects a range wider than a year', async () => {
      const response = await request(server())
        .get(`${API}/sales`)
        .query({
          from: '2020-01-01T00:00:00.000Z',
          to: '2026-01-01T00:00:00.000Z',
        })
        .set(...authHeader(agenda.owner))
        .expect(400);

      expect(response.body.code).toBe('SALES_RANGE_TOO_WIDE');
    });
  });

  describe('authorization (docs/permissions.md)', () => {
    let staffUser: RegisteredBusiness;
    let staffMemberId: string;

    beforeEach(async () => {
      const added = await addStaffUser(app, agenda.owner);

      staffUser = added.staffUser;
      staffMemberId = added.staffMemberId;
    });

    it('lets a STAFF user record the sale of their own work', async () => {
      const response = await sell(
        {
          staffMemberId,
          lines: [{ serviceId: agenda.serviceId }],
          paymentMethod: 'CASH',
        },
        staffUser,
      ).expect(201);

      expect(response.body.data.staffMember.id).toBe(staffMemberId);
    });

    it("refuses a STAFF user recording someone else's sale", async () => {
      const response = await sell(
        {
          staffMemberId: agenda.staffMemberId,
          lines: [{ serviceId: agenda.serviceId }],
        },
        staffUser,
      ).expect(403);

      expect(response.body.code).toBe('OWN_SALES_ONLY');
    });

    it('shows a STAFF user only their own sales', async () => {
      await sell({
        staffMemberId: agenda.staffMemberId,
        lines: [{ serviceId: agenda.serviceId }],
      }).expect(201);

      const own = await sell(
        { staffMemberId, lines: [{ serviceId: agenda.serviceId }] },
        staffUser,
      ).expect(201);

      const list = await request(server())
        .get(`${API}/sales`)
        .query({
          from: new Date(Date.now() - 86_400_000).toISOString(),
          to: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .set(...authHeader(staffUser))
        .expect(200);

      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].id).toBe(own.body.data.id);
    });

    it("hides another barber's sale behind a 404, never a 403", async () => {
      const foreign = await sell({
        staffMemberId: agenda.staffMemberId,
        lines: [{ serviceId: agenda.serviceId }],
      }).expect(201);

      const response = await request(server())
        .get(`${API}/sales/${foreign.body.data.id}`)
        .set(...authHeader(staffUser))
        .expect(404);

      expect(response.body.code).toBe('SALE_NOT_FOUND');
    });

    it('never lets a STAFF user void a sale', async () => {
      const own = await sell(
        { staffMemberId, lines: [{ serviceId: agenda.serviceId }] },
        staffUser,
      ).expect(201);

      await act(
        own.body.data.id as string,
        'cancel',
        { reason: 'Error' },
        staffUser,
      ).expect(403);
    });
  });

  describe('tenant isolation (ADR 0004)', () => {
    it("answers 404 for another tenant's sale", async () => {
      const mine = await sell({
        lines: [{ serviceId: agenda.serviceId }],
      }).expect(201);
      const other = await registerBusiness(app);

      await request(server())
        .get(`${API}/sales/${mine.body.data.id}`)
        .set(...authHeader(other))
        .expect(404);

      await request(server())
        .post(`${API}/sales/${mine.body.data.id}/cancel`)
        .set(...authHeader(other))
        .send({ reason: 'No es mía' })
        .expect(404);
    });

    it("refuses a sale pointing at another tenant's client", async () => {
      const other = await registerBusiness(app);
      const foreignClient = await request(server())
        .post(`${API}/clients`)
        .set(...authHeader(other))
        .send({ name: 'Cliente ajeno' })
        .expect(201);

      const response = await sell({
        clientId: foreignClient.body.data.id,
        lines: [{ serviceId: agenda.serviceId }],
      }).expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });
  });
});
