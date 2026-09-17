import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import type { EnvironmentVariables } from '../../src/config/environment.js';

/**
 * Boots the real application for end-to-end tests with the same global
 * pipeline as production (prefix, validation, hardening, filters), reading the
 * same configuration, so every e2e test exercises the actual HTTP contract.
 *
 * `.env.test` raises the rate limits: a test suite makes far more requests per
 * minute than a person, and throttling is verified by its own test instead.
 */
export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  setupApp(app, {
    corsOrigins: config.get('CORS_ORIGINS', { infer: true }),
    throttleTtl: config.get('THROTTLE_TTL', { infer: true }),
    throttleLimit: config.get('THROTTLE_LIMIT', { infer: true }),
    authThrottleLimit: config.get('AUTH_THROTTLE_LIMIT', { infer: true }),
  });

  await app.init();

  return app;
}
