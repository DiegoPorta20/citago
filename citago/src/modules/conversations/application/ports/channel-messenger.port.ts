import type { ConversationChannel } from '../../domain/conversation.enums.js';

export interface OutboundText {
  readonly tenantId: string;
  readonly channel: ConversationChannel;
  readonly recipient: string;
  readonly body: string;
}

export interface SentMessage {
  readonly externalMessageId: string;
}

export abstract class ChannelMessenger {
  abstract replyWindowMs(channel: ConversationChannel): number | null;

  abstract sendText(message: OutboundText): Promise<SentMessage>;
}
