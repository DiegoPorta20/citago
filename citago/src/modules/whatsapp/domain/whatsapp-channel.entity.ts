import { InvalidWhatsAppChannelDataError } from './whatsapp.errors.js';

const META_ID = /^\d{1,32}$/;
const MAX_DISPLAY_LENGTH = 32;
const MAX_NAME_LENGTH = 255;

export interface WhatsAppChannelSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly phoneNumberId: string;
  readonly wabaId: string | null;
  readonly displayPhoneNumber: string;
  readonly verifiedName: string | null;
  readonly encryptedAccessToken: Buffer;
  readonly connectedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WhatsAppConnection {
  readonly phoneNumberId: string;
  readonly wabaId?: string | null;
  readonly displayPhoneNumber: string;
  readonly verifiedName?: string | null;
  readonly encryptedAccessToken: Buffer;
}

export class WhatsAppChannel {
  private constructor(private state: WhatsAppChannelSnapshot) {}

  static connect(
    input: WhatsAppConnection & {
      readonly id: string;
      readonly tenantId: string;
    },
    now: Date,
  ): WhatsAppChannel {
    return new WhatsAppChannel({
      id: input.id,
      tenantId: input.tenantId,
      ...WhatsAppChannel.validate(input),
      connectedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(snapshot: WhatsAppChannelSnapshot): WhatsAppChannel {
    return new WhatsAppChannel(snapshot);
  }

  static tokenContext(tenantId: string, phoneNumberId: string): string {
    return `whatsapp:${tenantId}:${phoneNumberId}`;
  }

  reconnect(connection: WhatsAppConnection, now: Date): void {
    this.state = {
      ...this.state,
      ...WhatsAppChannel.validate(connection),
      connectedAt: now,
      updatedAt: now,
    };
  }

  get id(): string {
    return this.state.id;
  }

  get tenantId(): string {
    return this.state.tenantId;
  }

  get phoneNumberId(): string {
    return this.state.phoneNumberId;
  }

  get encryptedAccessToken(): Buffer {
    return this.state.encryptedAccessToken;
  }

  toSnapshot(): WhatsAppChannelSnapshot {
    return this.state;
  }

  private static validate(connection: WhatsAppConnection) {
    if (!META_ID.test(connection.phoneNumberId)) {
      throw new InvalidWhatsAppChannelDataError(
        'phoneNumberId',
        'it must be the numeric id Meta shows for the number',
      );
    }

    const wabaId = connection.wabaId?.trim() || null;

    if (wabaId !== null && !META_ID.test(wabaId)) {
      throw new InvalidWhatsAppChannelDataError(
        'wabaId',
        'it must be the numeric WhatsApp Business Account id',
      );
    }
    if (connection.encryptedAccessToken.length === 0) {
      throw new InvalidWhatsAppChannelDataError(
        'accessToken',
        'it cannot be empty',
      );
    }

    return {
      phoneNumberId: connection.phoneNumberId,
      wabaId,
      displayPhoneNumber: connection.displayPhoneNumber
        .trim()
        .slice(0, MAX_DISPLAY_LENGTH),
      verifiedName:
        connection.verifiedName?.trim().slice(0, MAX_NAME_LENGTH) || null,
      encryptedAccessToken: connection.encryptedAccessToken,
    };
  }
}
