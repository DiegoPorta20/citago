import { createHash, timingSafeEqual } from 'node:crypto';

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';

import type { EnvironmentVariables } from '../../../config/environment.js';
import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';
import { Public } from '../../../shared/presentation/decorators/public.decorator.js';
import { HandleGatewayEventUseCase } from '../application/billing.use-cases.js';
import { subscriptionIdFromEvent } from './culqi-event.parser.js';

class InvalidWebhookSecretError extends DomainError {
  readonly code = 'INVALID_WEBHOOK_SECRET';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('Invalid webhook secret.');
  }
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Culqi's panel only takes a URL, so the secret rides in the query string and
 * the URL must never be logged with it (the request logger prints the route
 * template, not the query). A leaked secret lets someone make us re-read a
 * subscription from Culqi, which is harmless: nothing in the payload is trusted.
 */
@ApiExcludeController()
@Public()
@Controller('webhooks/culqi')
export class CulqiWebhookController {
  private readonly secret: string;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly handleEvent: HandleGatewayEventUseCase,
  ) {
    this.secret = config.get('CULQI_WEBHOOK_SECRET', { infer: true });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Query('secret') secret: string | undefined,
    @Body() payload: unknown,
  ): Promise<{ received: true }> {
    if (
      this.secret.length === 0 ||
      !timingSafeEqual(digest(secret ?? ''), digest(this.secret))
    ) {
      throw new InvalidWebhookSecretError();
    }

    const subscriptionId = subscriptionIdFromEvent(payload);

    if (subscriptionId) {
      await this.handleEvent.execute(subscriptionId);
    }

    return { received: true };
  }
}
