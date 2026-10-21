import type { WhatsAppChannel } from './whatsapp-channel.entity.js';

export abstract class WhatsAppChannelRepository {
  abstract findByTenant(tenantId: string): Promise<WhatsAppChannel | null>;

  abstract findByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<WhatsAppChannel | null>;

  abstract save(channel: WhatsAppChannel): Promise<void>;

  abstract deleteForTenant(tenantId: string): Promise<void>;
}
