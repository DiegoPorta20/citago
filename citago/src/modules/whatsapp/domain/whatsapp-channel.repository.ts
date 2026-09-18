import type { WhatsAppChannel } from './whatsapp-channel.entity.js';

export abstract class WhatsAppChannelRepository {
  abstract findByTenant(tenantId: string): Promise<WhatsAppChannel | null>;

  /**
   * **Not tenant-scoped, by design** (ADR 0004): this is how an inbound
   * webhook finds its business. Only call it after the webhook signature has
   * been verified (rule CO-5).
   */
  abstract findByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<WhatsAppChannel | null>;

  /** Throws `WhatsAppNumberInUseError` if another business has the number. */
  abstract save(channel: WhatsAppChannel): Promise<void>;

  abstract deleteForTenant(tenantId: string): Promise<void>;
}
