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

/** One customer message, already translated from Meta's payload. */
export interface WhatsAppInboundMessage {
  /** The business number that received it. Decides the tenant (rule CO-5). */
  readonly phoneNumberId: string;
  /** The sender's WhatsApp id: their number, digits only. */
  readonly from: string;
  readonly contactName: string | null;
  /** Meta's `wamid...`: the idempotency key (rule CO-2). */
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
  /** For a number no business has connected, or content that is not valid. */
  readonly ignored: number;
}

/**
 * Hands the messages of a **signature-verified** webhook to Conversations.
 *
 * - The tenant is the business that connected the receiving number. The
 *   payload is trusted for that only because Meta signed it.
 * - A number nobody has connected (e.g. disconnected a minute ago) is skipped,
 *   not failed: failing would make Meta retry it for days.
 * - Invalid content is skipped for the same reason. Any other error (the
 *   database is down) propagates, Meta retries the whole delivery, and
 *   idempotency discards what was already stored.
 */
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

/** WhatsApp still reports Mexican mobiles with the legacy "1" after the country code. */
const LEGACY_MEXICAN_MOBILE = /^521(\d{10})$/;

/**
 * WhatsApp ids are the full international number without "+". Normalizing
 * through `PhoneNumber` makes them match clients typed by hand; if the phone
 * metadata does not know the number, the plain "+digits" is still E.164.
 *
 * Known gap: Argentine mobiles arrive with the "9" (549...), while a number
 * typed without it normalizes to 54...; those need a manual link (CO-6).
 */
export function toE164(waId: string): string {
  const digits = waId.replace(LEGACY_MEXICAN_MOBILE, '52$1');

  try {
    return PhoneNumber.create(`+${digits}`, 'US').value;
  } catch {
    return `+${digits}`;
  }
}
