import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import type { EnvironmentVariables } from '../../src/config/environment.js';

export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    rawBody: true,
  });
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
