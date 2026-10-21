import { Injectable, Logger } from '@nestjs/common';

import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';
import { PhoneNumber } from '../../../shared/domain/phone-number.js';
import { RecordInboundMessageUseCase } from '../../conversations/application/record-inbound-message.use-case.js';
import {
  ConversationChannel,
  type MessageType,
} from '../../conversations/domain/conversation.enums.js';
import type { WhatsAppChannel } from '../domain/whatsapp-channel.entity.js';
import { WhatsAppChannelRepository } from '../domain/whatsapp-channel.repository.js';

export interface WhatsAppInboundMessage {
  readonly phoneNumberId: string;
  readonly from: string;
  readonly contactName: string | null;
  readonly messageId: string;
  readonly sentAt: Date;
  readonly type: MessageType;
  readonly body: string | null;
  readonly mediaId: string | null;
  readonly mediaMimeType: string | null;
}

export interface WebhookOutcome {
  readonly recorded: number;
  readonly duplicates: number;
  readonly ignored: number;
}

@Injectable()
export class ProcessWhatsAppWebhookUseCase {
  private readonly logger = new Logger(ProcessWhatsAppWebhookUseCase.name);

  constructor(
    private readonly channels: WhatsAppChannelRepository,
    private readonly recordInbound: RecordInboundMessageUseCase,
  ) {}

  async execute(
    messages: readonly WhatsAppInboundMessage[],
  ): Promise<WebhookOutcome> {
    const channelsByNumber = new Map<string, WhatsAppChannel | null>();
    let recorded = 0;
    let duplicates = 0;
    let ignored = 0;

    for (const message of messages) {
      if (!channelsByNumber.has(message.phoneNumberId)) {
        channelsByNumber.set(
          message.phoneNumberId,
          await this.channels.findByPhoneNumberId(message.phoneNumberId),
        );
      }

      const channel = channelsByNumber.get(message.phoneNumberId);

      if (!channel) {
        this.logger.warn(
          `Ignored a message for phone number id ${message.phoneNumberId}: no business has it connected.`,
        );
        ignored += 1;
        continue;
      }

      try {
        const result = await this.recordInbound.execute({
          tenantId: channel.tenantId,
          channel: ConversationChannel.WhatsApp,
          contactIdentifier: toE164(message.from),
          contactName: message.contactName,
          externalMessageId: message.messageId,
          type: message.type,
          body: message.body,
          mediaReference: message.mediaId,
          mediaMimeType: message.mediaMimeType,
          sentAt: message.sentAt,
        });

        if (result.outcome === 'recorded') {
          recorded += 1;
        } else {
          duplicates += 1;
        }
      } catch (error) {
        if (
          error instanceof DomainError &&
          error.category === DomainErrorCategory.Validation
        ) {
          this.logger.warn(
            `Ignored message ${message.messageId}: ${error.code}.`,
          );
          ignored += 1;
          continue;
        }

        throw error;
      }
    }

    return { recorded, duplicates, ignored };
  }
}

const LEGACY_MEXICAN_MOBILE = /^521(\d{10})$/;

export function toE164(waId: string): string {
  const digits = waId.replace(LEGACY_MEXICAN_MOBILE, '52$1');

  try {
    return PhoneNumber.create(`+${digits}`, 'US').value;
  } catch {
    return `+${digits}`;
  }
}
