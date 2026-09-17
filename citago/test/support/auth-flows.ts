import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { API_PREFIX } from '../../src/config/api.constants.js';
import type { UserRole } from '../../src/shared/domain/user-role.js';

export const API = `/${API_PREFIX}`;

export interface RegisteredBusiness {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: UserRole;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly email: string;
  readonly password: string;
}

export interface RegisterOptions {
  readonly businessName?: string;
  readonly email?: string;
  readonly password?: string;
  readonly country?: string;
  readonly currency?: string;
  readonly timezone?: string;
}

/**
 * Registers a business through the real HTTP endpoint.
 *
 * Tests build their world the way a client would, so nothing can pass here and
 * fail in production.
 */
export async function registerBusiness(
  app: NestExpressApplication,
  options: RegisterOptions = {},
): Promise<RegisteredBusiness> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const email = options.email ?? `owner-${suffix}@demo.local`;
  const password = options.password ?? 'unaClaveSegura1';

  const response = await request(app.getHttpServer())
    .post(`${API}/auth/register`)
    .send({
      businessName: options.businessName ?? `Barbería ${suffix}`,
      country: options.country ?? 'PE',
      currency: options.currency ?? 'PEN',
      timezone: options.timezone ?? 'America/Lima',
      ownerName: 'Owner Demo',
      ownerEmail: email,
      password,
    })
    .expect(201);

  const data = response.body.data as {
    tenantId: string;
    userId: string;
    role: UserRole;
    accessToken: string;
    refreshToken: string;
  };

  return { ...data, email, password };
}

/**
 * Two independent businesses, for the isolation checks every tenant-owned
 * feature must include: what tenant A does must never reach tenant B.
 */
export async function createTwoTenants(app: NestExpressApplication): Promise<{
  tenantA: RegisteredBusiness;
  tenantB: RegisteredBusiness;
}> {
  const tenantA = await registerBusiness(app, { businessName: 'Barbería A' });
  const tenantB = await registerBusiness(app, { businessName: 'Barbería B' });

  return { tenantA, tenantB };
}

export function authHeader(business: RegisteredBusiness): [string, string] {
  return ['Authorization', `Bearer ${business.accessToken}`];
}
