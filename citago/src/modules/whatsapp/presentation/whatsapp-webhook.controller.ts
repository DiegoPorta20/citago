import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { Public } from '../../../shared/presentation/decorators/public.decorator.js';
import {
  ProcessWhatsAppWebhookUseCase,
  type WebhookOutcome,
} from '../application/process-whatsapp-webhook.use-case.js';
import { WebhookVerificationFailedError } from '../domain/whatsapp.errors.js';
import { MetaWebhookVerifier } from '../infrastructure/webhook/meta-webhook-verifier.js';
import { parseMetaWebhook } from './meta-webhook.parser.js';
import { WhatsAppSignatureGuard } from './whatsapp-signature.guard.js';

/**
 * Meta's entry point. Public (Meta has no CitaGo session) but not open:
 * subscription needs the verify token and every delivery needs a valid
 * signature. Hidden from Swagger: it is Meta's contract, not ours.
 */
@ApiExcludeController()
@Public()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    private readonly verifier: MetaWebhookVerifier,
    private readonly processWebhook: ProcessWhatsAppWebhookUseCase,
  ) {}

  /** Subscription handshake: answer the challenge as plain text. */
  @Get()
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() response: Response,
  ): void {
    // The challenge is echoed back, so only Meta's plain token shape is accepted.
    if (
      !challenge ||
      !/^[A-Za-z0-9_-]{1,256}$/.test(challenge) ||
      !this.verifier.isValidSubscription(mode, token)
    ) {
      throw new WebhookVerificationFailedError();
    }

    response.status(HttpStatus.OK).type('text/plain').send(challenge);
  }

  /**
   * Answers 200 once the messages are stored, so a failure makes Meta retry
   * (idempotency absorbs the repeats). Unknown numbers and receipts also get
   * 200: there is nothing a retry could fix.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(WhatsAppSignatureGuard)
  receive(@Body() payload: unknown): Promise<WebhookOutcome> {
    return this.processWebhook.execute(parseMetaWebhook(payload));
  }
}
