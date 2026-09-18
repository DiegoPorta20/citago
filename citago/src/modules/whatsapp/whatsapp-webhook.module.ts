import { Module } from '@nestjs/common';

import { ConversationsModule } from '../conversations/conversations.module.js';
import { ProcessWhatsAppWebhookUseCase } from './application/process-whatsapp-webhook.use-case.js';
import { MetaWebhookVerifier } from './infrastructure/webhook/meta-webhook-verifier.js';
import { WhatsAppSignatureGuard } from './presentation/whatsapp-signature.guard.js';
import { WhatsAppWebhookController } from './presentation/whatsapp-webhook.controller.js';
import { WhatsAppModule } from './whatsapp.module.js';

/** Meta → CitaGo: verified webhooks become inbound conversation messages. */
@Module({
  imports: [WhatsAppModule, ConversationsModule],
  controllers: [WhatsAppWebhookController],
  providers: [
    MetaWebhookVerifier,
    WhatsAppSignatureGuard,
    ProcessWhatsAppWebhookUseCase,
  ],
})
export class WhatsAppWebhookModule {}
