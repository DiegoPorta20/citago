import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';

import { InvalidWebhookSignatureError } from '../domain/whatsapp.errors.js';
import { MetaWebhookVerifier } from '../infrastructure/webhook/meta-webhook-verifier.js';

/**
 * Rejects any webhook Meta did not sign, before the payload is read and before
 * any database access. Only after this does the payload's phone number id get
 * to decide the tenant (rule CO-5).
 */
@Injectable()
export class WhatsAppSignatureGuard implements CanActivate {
  constructor(private readonly verifier: MetaWebhookVerifier) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();
    const header = request.headers['x-hub-signature-256'];

    if (
      !this.verifier.hasValidSignature(
        request.rawBody,
        Array.isArray(header) ? undefined : header,
      )
    ) {
      throw new InvalidWebhookSignatureError();
    }

    return true;
  }
}
