import { Module } from '@nestjs/common';

import { ChannelMessenger } from '../conversations/application/ports/channel-messenger.port.js';
import { WhatsAppCloudApi } from './application/ports/whatsapp-cloud-api.port.js';
import { WhatsAppChannelMessenger } from './application/whatsapp-channel-messenger.js';
import {
  ConnectWhatsAppChannelUseCase,
  DisconnectWhatsAppChannelUseCase,
  GetWhatsAppChannelUseCase,
} from './application/whatsapp-channel.use-cases.js';
import { WhatsAppChannelRepository } from './domain/whatsapp-channel.repository.js';
import { GraphWhatsAppCloudApi } from './infrastructure/cloud-api/graph-whatsapp-cloud-api.js';
import { TypeOrmWhatsAppChannelRepository } from './infrastructure/persistence/typeorm/typeorm-whatsapp-channel.repository.js';
import { WhatsAppChannelController } from './presentation/whatsapp-channel.controller.js';

/**
 * The WhatsApp adapter: the business's connected number, Meta's Cloud API,
 * and the outbound side of Conversations (`ChannelMessenger`).
 *
 * Inbound webhooks live in `WhatsAppWebhookModule`, which depends on
 * Conversations; keeping them apart avoids a module cycle.
 */
@Module({
  controllers: [WhatsAppChannelController],
  providers: [
    {
      provide: WhatsAppChannelRepository,
      useClass: TypeOrmWhatsAppChannelRepository,
    },
    { provide: WhatsAppCloudApi, useClass: GraphWhatsAppCloudApi },
    { provide: ChannelMessenger, useClass: WhatsAppChannelMessenger },
    ConnectWhatsAppChannelUseCase,
    GetWhatsAppChannelUseCase,
    DisconnectWhatsAppChannelUseCase,
  ],
  exports: [WhatsAppChannelRepository, ChannelMessenger],
})
export class WhatsAppModule {}
