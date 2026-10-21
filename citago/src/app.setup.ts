import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import helmet from 'helmet';

type RateLimitHandler = (request: Request, response: Response) => void;

import { API_PREFIX, JSON_BODY_LIMIT } from './config/api.constants.js';

const tooManyRequests: RateLimitHandler = (request, response) => {
  response.status(HttpStatus.TOO_MANY_REQUESTS).json({
    statusCode: HttpStatus.TOO_MANY_REQUESTS,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests. Try again later.',
    timestamp: new Date().toISOString(),
    path: request.originalUrl,
  });
};

export interface AppSetupOptions {
  readonly corsOrigins?: string;
  readonly throttleTtl?: number;
  readonly throttleLimit?: number;
  readonly authThrottleLimit?: number;
}

const DEFAULT_THROTTLE_TTL = 60_000;
const WEBHOOKS_PATH = `/${API_PREFIX}/webhooks/`;
const DEFAULT_THROTTLE_LIMIT = 120;
const DEFAULT_AUTH_THROTTLE_LIMIT = 20;

export function setupApp(
  app: NestExpressApplication,
  options: AppSetupOptions = {},
): void {
  app.use(helmet());

  app.use(
    rateLimit({
      windowMs: options.throttleTtl ?? DEFAULT_THROTTLE_TTL,
      limit: options.throttleLimit ?? DEFAULT_THROTTLE_LIMIT,
      skip: (request) => request.originalUrl.startsWith(WEBHOOKS_PATH),
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: tooManyRequests,
    }),
  );

  app.use(
    `/${API_PREFIX}/auth`,
    rateLimit({
      windowMs: options.throttleTtl ?? DEFAULT_THROTTLE_TTL,
      limit: options.authThrottleLimit ?? DEFAULT_AUTH_THROTTLE_LIMIT,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: tooManyRequests,
    }),
  );

  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.setGlobalPrefix(API_PREFIX);

  const corsOrigins = (options.corsOrigins ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: true,
    }),
  );
}
