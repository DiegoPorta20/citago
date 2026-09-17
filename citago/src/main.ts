import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';
import { API_PREFIX, SWAGGER_PATH } from './config/api.constants.js';
import {
  NodeEnvironment,
  type EnvironmentVariables,
} from './config/environment.js';

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === NodeEnvironment.Production;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Needed later to verify WhatsApp webhook signatures over the exact bytes.
    rawBody: true,
    bufferLogs: true,
    logger: new ConsoleLogger({ json: isProduction }),
  });

  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  setupApp(app, {
    corsOrigins: config.get('CORS_ORIGINS', { infer: true }),
    throttleTtl: config.get('THROTTLE_TTL', { infer: true }),
    throttleLimit: config.get('THROTTLE_LIMIT', { infer: true }),
    authThrottleLimit: config.get('AUTH_THROTTLE_LIMIT', { infer: true }),
  });

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('CitaGo API')
        .setDescription(
          'Multi-tenant API for appointment-based businesses. Every tenant-owned resource is scoped to the authenticated tenant.',
        )
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
        .build(),
    );

    SwaggerModule.setup(SWAGGER_PATH, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  new ConsoleLogger('Bootstrap', { json: isProduction }).log(
    `CitaGo API listening on port ${port} (/${API_PREFIX})`,
  );
}

void bootstrap();
