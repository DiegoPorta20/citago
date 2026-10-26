import { Module } from '@nestjs/common';

import { ChannelMessenger } from '../conversations/application/ports/channel-messenger.port.js';
import { WhatsAppCloudApi } from './application/ports/whatsapp-cloud-api.port.js';
import { WhatsAppChannelMessenger } from './application/whatsapp-channel-messenger.js';
import {
  CompleteEmbeddedSignupUseCase,
  GetEmbeddedSignupConfigUseCase,
  StartEmbeddedSignupUseCase,
  WhatsAppChannelConnector,
} from './application/embedded-signup.use-cases.js';
import { EmbeddedSignupSettings } from './application/ports/embedded-signup-settings.port.js';
import {
  ConnectWhatsAppChannelUseCase,
  DisconnectWhatsAppChannelUseCase,
  GetWhatsAppChannelUseCase,
} from './application/whatsapp-channel.use-cases.js';
import { WhatsAppChannelRepository } from './domain/whatsapp-channel.repository.js';
import { GraphWhatsAppCloudApi } from './infrastructure/cloud-api/graph-whatsapp-cloud-api.js';
import { ConfigEmbeddedSignupSettings } from './infrastructure/embedded-signup/config-embedded-signup-settings.js';
import { TypeOrmWhatsAppChannelRepository } from './infrastructure/persistence/typeorm/typeorm-whatsapp-channel.repository.js';
import { EmbeddedSignupController } from './presentation/embedded-signup.controller.js';
import { WhatsAppChannelController } from './presentation/whatsapp-channel.controller.js';

@Module({
  controllers: [WhatsAppChannelController, EmbeddedSignupController],
  providers: [
    {
      provide: WhatsAppChannelRepository,
      useClass: TypeOrmWhatsAppChannelRepository,
    },
    { provide: WhatsAppCloudApi, useClass: GraphWhatsAppCloudApi },
    { provide: ChannelMessenger, useClass: WhatsAppChannelMessenger },
    { provide: EmbeddedSignupSettings, useClass: ConfigEmbeddedSignupSettings },
    WhatsAppChannelConnector,
    StartEmbeddedSignupUseCase,
    GetEmbeddedSignupConfigUseCase,
    CompleteEmbeddedSignupUseCase,
    ConnectWhatsAppChannelUseCase,
    GetWhatsAppChannelUseCase,
    DisconnectWhatsAppChannelUseCase,
  ],
  exports: [WhatsAppChannelRepository, ChannelMessenger],
})
export class WhatsAppModule {}
