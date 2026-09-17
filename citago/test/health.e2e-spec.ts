import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { createTestApp } from './support/create-test-app.js';

describe('Foundation (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/health reports the API and the database as reachable', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toEqual({
      data: {
        status: 'ok',
        uptimeSeconds: expect.any(Number),
        database: 'up',
        timestamp: expect.any(String),
      },
      meta: {},
    });
  });

  it('serves the API only under the versioned prefix', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('returns the shared error shape for an unknown route', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      path: '/api/v1/does-not-exist',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('applies helmet: no technology fingerprint, and content sniffing blocked', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    // helmet is applied by setupApp, the same code path production uses.
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
