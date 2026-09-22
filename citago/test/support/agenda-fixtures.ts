import type { NestExpressApplication } from '@nestjs/platform-express';
import { DateTime, type WeekdayNumbers } from 'luxon';
import request from 'supertest';

import { UserRole } from '../../src/shared/domain/user-role.js';
import {
  API,
  authHeader,
  registerBusiness,
  type RegisteredBusiness,
} from './auth-flows.js';

const LIMA = 'America/Lima';

/**
 * A local date in Lima, `weeksAhead` weeks from now, on the given ISO weekday.
 * Computed at runtime so the suite never books "in the past" as time goes by.
 */
export function futureLocalDate(
  weekday: WeekdayNumbers,
  weeksAhead = 2,
): string {
  const today = DateTime.now().setZone(LIMA).startOf('day');
  const target = today.plus({ weeks: weeksAhead }).set({ weekday });

  return target.toISODate() as string;
}

/** A Lima wall-clock time on a local date, as a UTC ISO string. */
export function limaInstant(localDate: string, time: string): string {
  return DateTime.fromISO(`${localDate}T${time}`, { zone: LIMA })
    .toUTC()
    .toISO() as string;
}

/** Monday to Saturday, 09:00–13:00 and 15:00–20:00: a lunch break in between. */
export const STANDARD_WEEK = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, startsAt: '09:00', endsAt: '13:00' },
  { weekday, startsAt: '15:00', endsAt: '20:00' },
]);

export interface Agenda {
  readonly owner: RegisteredBusiness;
  readonly staffMemberId: string;
  readonly serviceId: string;
  readonly clientId: string;
  /** A Monday two weeks from now. */
  readonly monday: string;
}

/** A business with one barber on the standard week, a 30-minute service and a client. */
export async function createAgenda(
  app: NestExpressApplication,
  owner?: RegisteredBusiness,
): Promise<Agenda> {
  const business = owner ?? (await registerBusiness(app));
  const server = app.getHttpServer();

  const staff = await request(server)
    .post(`${API}/staff`)
    .set(...authHeader(business))
    .send({ displayName: 'Carlos' })
    .expect(201);

  await request(server)
    .put(`${API}/staff/${staff.body.data.id}/schedule`)
    .set(...authHeader(business))
    .send({ ranges: STANDARD_WEEK })
    .expect(200);

  const service = await request(server)
    .post(`${API}/services`)
    .set(...authHeader(business))
    .send({ name: 'Corte de cabello', durationMinutes: 30, price: '25.00' })
    .expect(201);

  const client = await request(server)
    .post(`${API}/clients`)
    .set(...authHeader(business))
    .send({ name: 'Juan Pérez', phone: '999999999' })
    .expect(201);

  return {
    owner: business,
    staffMemberId: staff.body.data.id as string,
    serviceId: service.body.data.id as string,
    clientId: client.body.data.id as string,
    monday: futureLocalDate(1),
  };
}

/**
 * A STAFF account inside the owner's business, linked to a new staff member.
 *
 * Everything goes through the real API — the owner grants access, the person
 * signs in, the owner links them to a barber — so the fixture walks the same
 * path a business would.
 */
export async function addStaffUser(
  app: NestExpressApplication,
  owner: RegisteredBusiness,
): Promise<{ staffUser: RegisteredBusiness; staffMemberId: string }> {
  const server = app.getHttpServer();
  const suffix = Math.random().toString(36).slice(2, 10);
  const email = `barbero-${suffix}@demo.local`;
  const password = 'unaClaveSegura1';

  await request(server)
    .post(`${API}/users`)
    .set(...authHeader(owner))
    .send({ name: 'Barbero STAFF', email, role: UserRole.Staff, password })
    .expect(201);

  const login = await request(server)
    .post(`${API}/auth/login`)
    .send({ email, password })
    .expect(200);

  const session = login.body.data as {
    tenantId: string;
    userId: string;
    role: UserRole;
    accessToken: string;
    refreshToken: string;
  };

  const staff = await request(server)
    .post(`${API}/staff`)
    .set(...authHeader(owner))
    .send({ displayName: 'Barbero STAFF', userId: session.userId })
    .expect(201);

  await request(server)
    .put(`${API}/staff/${staff.body.data.id}/schedule`)
    .set(...authHeader(owner))
    .send({ ranges: STANDARD_WEEK })
    .expect(200);

  return {
    staffUser: { ...session, email, password },
    staffMemberId: staff.body.data.id as string,
  };
}
