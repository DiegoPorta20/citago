import type { NestExpressApplication } from '@nestjs/platform-express';
import { DateTime, type WeekdayNumbers } from 'luxon';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { v7 as uuidV7 } from 'uuid';

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
 * A STAFF account inside `owner`'s business, linked to a new staff member.
 *
 * There is no invitation endpoint yet, so the membership is written directly.
 * Everything after that goes through the real API: login, linking, booking.
 */
export async function addStaffUser(
  app: NestExpressApplication,
  dataSource: DataSource,
  owner: RegisteredBusiness,
): Promise<{ staffUser: RegisteredBusiness; staffMemberId: string }> {
  const server = app.getHttpServer();
  const person = await registerBusiness(app);

  // Leave their own business and join the owner's as STAFF, so login lands there.
  await dataSource.query(
    'UPDATE memberships SET status = ? WHERE user_id = ?',
    ['INACTIVE', person.userId],
  );
  await dataSource.query(
    `INSERT INTO memberships (id, tenant_id, user_id, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', NOW(3), NOW(3))`,
    [uuidV7(), owner.tenantId, person.userId, UserRole.Staff],
  );

  const login = await request(server)
    .post(`${API}/auth/login`)
    .send({ email: person.email, password: person.password })
    .expect(200);

  const staff = await request(server)
    .post(`${API}/staff`)
    .set(...authHeader(owner))
    .send({ displayName: 'Barbero STAFF', userId: person.userId })
    .expect(201);

  await request(server)
    .put(`${API}/staff/${staff.body.data.id}/schedule`)
    .set(...authHeader(owner))
    .send({ ranges: STANDARD_WEEK })
    .expect(200);

  return {
    staffUser: {
      ...person,
      tenantId: owner.tenantId,
      role: UserRole.Staff,
      accessToken: login.body.data.accessToken as string,
      refreshToken: login.body.data.refreshToken as string,
    },
    staffMemberId: staff.body.data.id as string,
  };
}
