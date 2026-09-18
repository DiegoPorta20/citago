import type { ConversationChannel } from '../../domain/conversation.enums.js';

export interface OutboundText {
  readonly tenantId: string;
  readonly channel: ConversationChannel;
  /** The conversation's contact identifier (E.164 for WhatsApp). */
  readonly recipient: string;
  readonly body: string;
}

export interface SentMessage {
  /** The channel's id for the message; stored as its idempotency key. */
  readonly externalMessageId: string;
}

/**
 * Sends messages through whatever channel a conversation happens on.
 *
 * Implemented by the channel adapters (WhatsApp first). Conversations never
 * know about Meta, tokens or phone number ids.
 *
 * Failures are reported with the conversation errors `ChannelNotConnectedError`,
 * `ReplyWindowClosedError` and `MessageDeliveryFailedError`.
 */
export abstract class ChannelMessenger {
  /**
   * How long after the contact's last message a free-form reply is allowed,
   * in milliseconds; `null` when the channel imposes no limit.
   */
  abstract replyWindowMs(channel: ConversationChannel): number | null;

  abstract sendText(message: OutboundText): Promise<SentMessage>;
}
