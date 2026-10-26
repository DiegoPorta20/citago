import {
  EmbeddedSignupSettings,
  type EmbeddedSignupConfig,
} from '../../../src/modules/whatsapp/application/ports/embedded-signup-settings.port.js';
import {
  WhatsAppApiError,
  WhatsAppCloudApi,
  type WhatsAppApiFailure,
  type WhatsAppPhoneNumberInfo,
} from '../../../src/modules/whatsapp/application/ports/whatsapp-cloud-api.port.js';
import type { WhatsAppChannel } from '../../../src/modules/whatsapp/domain/whatsapp-channel.entity.js';
import { WhatsAppChannelRepository } from '../../../src/modules/whatsapp/domain/whatsapp-channel.repository.js';
import { WhatsAppNumberInUseError } from '../../../src/modules/whatsapp/domain/whatsapp.errors.js';
import {
  HandoffTokens,
  type HandoffClaims,
  type HandoffPurpose,
} from '../../../src/shared/application/ports/handoff-tokens.port.js';
import { SecretCipher } from '../../../src/shared/application/ports/secret-cipher.port.js';

export class InMemoryWhatsAppChannelRepository extends WhatsAppChannelRepository {
  readonly channels = new Map<string, WhatsAppChannel>();

  async findByTenant(tenantId: string): Promise<WhatsAppChannel | null> {
    return (
      [...this.channels.values()].find(
        (channel) => channel.tenantId === tenantId,
      ) ?? null
    );
  }

  async findByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<WhatsAppChannel | null> {
    return (
      [...this.channels.values()].find(
        (channel) => channel.phoneNumberId === phoneNumberId,
      ) ?? null
    );
  }

  async save(channel: WhatsAppChannel): Promise<void> {
    const taken = await this.findByPhoneNumberId(channel.phoneNumberId);

    if (taken && taken.tenantId !== channel.tenantId) {
      throw new WhatsAppNumberInUseError();
    }

    this.channels.set(channel.id, channel);
  }

  async deleteForTenant(tenantId: string): Promise<void> {
    for (const [id, channel] of this.channels) {
      if (channel.tenantId === tenantId) {
        this.channels.delete(id);
      }
    }
  }
}

/** Reversible, readable: tests can see what was encrypted. */
export class FakeSecretCipher extends SecretCipher {
  encrypt(plaintext: string, context: string): Buffer {
    return Buffer.from(`${context}|${plaintext}`);
  }

  decrypt(ciphertext: Buffer, context: string): string {
    const [stored, ...rest] = ciphertext.toString().split('|');

    if (stored !== context) {
      throw new Error('wrong context');
    }

    return rest.join('|');
  }
}

export const TOKEN = 'EAAG-customer-token-0123456789';

/** Records every call, in order; any step can be told to fail. */
export class ScriptedCloudApi extends WhatsAppCloudApi {
  readonly calls: string[] = [];
  private readonly failures = new Map<string, WhatsAppApiFailure>();

  failAt(step: string, failure: WhatsAppApiFailure): void {
    this.failures.set(step, failure);
  }

  async getPhoneNumber(
    phoneNumberId: string,
    _accessToken: string,
  ): Promise<WhatsAppPhoneNumberInfo> {
    this.step(`getPhoneNumber:${phoneNumberId}`, 'getPhoneNumber');

    return { displayPhoneNumber: '+51 999 999 999', verifiedName: 'Barbería' };
  }

  async exchangeCode(code: string): Promise<string> {
    this.step(`exchangeCode:${code}`, 'exchangeCode');

    return TOKEN;
  }

  async subscribeApp(wabaId: string, accessToken: string): Promise<void> {
    this.step(`subscribeApp:${wabaId}:${accessToken}`, 'subscribeApp');
  }

  async registerPhone(
    phoneNumberId: string,
    _accessToken: string,
  ): Promise<void> {
    this.step(`registerPhone:${phoneNumberId}`, 'registerPhone');
  }

  async sendText(): Promise<string> {
    return 'wamid.fake';
  }

  private step(call: string, name: string): void {
    this.calls.push(call);

    const failure = this.failures.get(name);

    if (failure) {
      throw new WhatsAppApiError(failure);
    }
  }
}

export class FixedSignupSettings extends EmbeddedSignupSettings {
  readonly pageBaseUrl = 'https://api.citago.test';

  constructor(
    private readonly config: EmbeddedSignupConfig | null = {
      appId: 'app-1',
      configId: 'config-1',
      graphVersion: 'v23.0',
    },
  ) {
    super();
  }

  get(): EmbeddedSignupConfig | null {
    return this.config;
  }
}

/** Opaque tokens kept in memory: enough to test who a link was issued for. */
export class FakeHandoffTokens extends HandoffTokens {
  readonly ttlSeconds = 900;
  private readonly issued = new Map<string, HandoffClaims>();

  issue(claims: HandoffClaims): string {
    const token = `fake-token-${this.issued.size + 1}`;

    this.issued.set(token, claims);

    return token;
  }

  verify(token: string, purpose: HandoffPurpose): HandoffClaims | null {
    const claims = this.issued.get(token);

    return claims && claims.purpose === purpose ? claims : null;
  }
}
