import { Module } from '@nestjs/common';

import { ClientsModule } from '../clients/clients.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { WhatsAppModule } from '../whatsapp/whatsapp.module.js';
import {
  ArchiveConversationUseCase,
  AssignConversationUseCase,
  ConversationChanges,
  LinkConversationClientUseCase,
  MarkConversationResolvedUseCase,
  ReopenConversationUseCase,
} from './application/conversation-management.use-cases.js';
import {
  ConversationViewAssembler,
  GetConversationUseCase,
  ListInboxUseCase,
  ListMessagesUseCase,
} from './application/conversation-queries.js';
import { RecordInboundMessageUseCase } from './application/record-inbound-message.use-case.js';
import { SendReplyUseCase } from './application/send-reply.use-case.js';
import {
  ConversationRepository,
  MessageRepository,
} from './domain/conversation.repositories.js';
import {
  TypeOrmConversationRepository,
  TypeOrmMessageRepository,
} from './infrastructure/persistence/typeorm/typeorm-conversation.repositories.js';
import { ConversationsDevController } from './presentation/conversations-dev.controller.js';
import { ConversationsController } from './presentation/conversations.controller.js';

@Module({
  imports: [ClientsModule, IdentityModule, WhatsAppModule],
  controllers: [ConversationsController, ConversationsDevController],
  providers: [
    {
      provide: ConversationRepository,
      useClass: TypeOrmConversationRepository,
    },
    { provide: MessageRepository, useClass: TypeOrmMessageRepository },
    RecordInboundMessageUseCase,
    SendReplyUseCase,
    ConversationChanges,
    MarkConversationResolvedUseCase,
    ArchiveConversationUseCase,
    ReopenConversationUseCase,
    LinkConversationClientUseCase,
    AssignConversationUseCase,
    ConversationViewAssembler,
    ListInboxUseCase,
    GetConversationUseCase,
    ListMessagesUseCase,
  ],
  exports: [RecordInboundMessageUseCase, ConversationRepository],
})
export class ConversationsModule {}
