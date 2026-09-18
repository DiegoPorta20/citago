import { Injectable } from '@nestjs/common';

import { SecretCipher } from '../../../shared/application/ports/secret-cipher.port.js';
import {
  ChannelMessenger,
  type OutboundText,
  type SentMessage,
} from '../../conversations/application/ports/channel-messenger.port.js';
import { ConversationChannel } from '../../conversations/domain/conversation.enums.js';
import {
  ChannelNotConnectedError,
  MessageDeliveryFailedError,
  ReplyWindowClosedError,
} from '../../conversations/domain/conversation.errors.js';
import { WhatsAppChannel } from '../domain/whatsapp-channel.entity.js';
import { WhatsAppChannelRepository } from '../domain/whatsapp-channel.repository.js';
import {
  WhatsAppApiError,
  WhatsAppCloudApi,
} from './ports/whatsapp-cloud-api.port.js';

/** Meta's customer service window. */
const WHATSAPP_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Conversations' outbound port, implemented for WhatsApp.
 *
 * The token is decrypted here, used for one call and dropped; it is never
 * logged, returned or kept in memory beyond the request.
 */
@Injectable()
export class WhatsAppChannelMessenger extends ChannelMessenger {
  constructor(
    private readonly channels: WhatsAppChannelRepository,
    private readonly cloudApi: WhatsAppCloudApi,
    private readonly cipher: SecretCipher,
  ) {
    super();
  }

  replyWindowMs(channel: ConversationChannel): number | null {
    return channel === ConversationChannel.WhatsApp
      ? WHATSAPP_REPLY_WINDOW_MS
      : null;
  }

  async sendText(message: OutboundText): Promise<SentMessage> {
    if (message.channel !== ConversationChannel.WhatsApp) {
      throw new ChannelNotConnectedError();
    }

    const channel = await this.channels.findByTenant(message.tenantId);

    if (!channel) {
      throw new ChannelNotConnectedError();
    }

    const accessToken = this.cipher.decrypt(
      channel.encryptedAccessToken,
      WhatsAppChannel.tokenContext(channel.tenantId, channel.phoneNumberId),
    );

    try {
      const externalMessageId = await this.cloudApi.sendText({
        phoneNumberId: channel.phoneNumberId,
        accessToken,
        to: message.recipient,
        body: message.body,
      });

      return { externalMessageId };
    } catch (error) {
      if (!(error instanceof WhatsAppApiError)) {
        throw error;
      }

      switch (error.failure) {
        case 'WINDOW_CLOSED':
          throw new ReplyWindowClosedError();
        case 'UNAUTHORIZED':
          throw new MessageDeliveryFailedError('CHANNEL_AUTH');
        case 'REJECTED':
          throw new MessageDeliveryFailedError('REJECTED');
        case 'UNAVAILABLE':
          throw new MessageDeliveryFailedError('UNAVAILABLE');
      }
    }
  }
}
