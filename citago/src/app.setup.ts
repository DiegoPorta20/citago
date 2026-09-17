import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import helmet from 'helmet';

type RateLimitHandler = (request: Request, response: Response) => void;

import { API_PREFIX, JSON_BODY_LIMIT } from './config/api.constants.js';

/** Same error shape as every other endpoint. */
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
  /** Comma-separated browser origins. Empty disables CORS. */
  readonly corsOrigins?: string;
  /** Rate limit window in milliseconds. */
  readonly throttleTtl?: number;
  /** Requests allowed per window, per IP. */
  readonly throttleLimit?: number;
  /** Requests allowed per window on /auth, per IP. */
  readonly authThrottleLimit?: number;
}

const DEFAULT_THROTTLE_TTL = 60_000;
const DEFAULT_THROTTLE_LIMIT = 120;
const DEFAULT_AUTH_THROTTLE_LIMIT = 20;

/**
 * Applies the global HTTP pipeline.
 *
 * Shared by `main.ts` and the end-to-end test harness so tests exercise the
 * same prefix, validation and hardening as production.
 */
export function setupApp(
  app: NestExpressApplication,
  options: AppSetupOptions = {},
): void {
  app.use(helmet());

  // Coarse protection against abuse and credential stuffing. Per-endpoint
  // limits (login, webhook) are added by their own modules.
  //
  // In-memory store: correct for a single instance. Running several instances
  // will need a shared store.
  app.use(
    rateLimit({
      windowMs: options.throttleTtl ?? DEFAULT_THROTTLE_TTL,
      limit: options.throttleLimit ?? DEFAULT_THROTTLE_LIMIT,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: tooManyRequests,
    }),
  );

  // Authentication is the credential-stuffing door, so it gets its own,
  // much stricter budget on top of the global one.
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

  // The client is a native app, so no browser origin is allowed by default.
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      // Strips unknown properties and rejects them: blocks mass assignment,
      // including any attempt to send tenantId from the client.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: true,
    }),
  );
}
