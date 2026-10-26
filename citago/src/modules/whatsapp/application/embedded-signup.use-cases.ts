import { Injectable } from '@nestjs/common';

import { Clock } from '../../../shared/application/ports/clock.port.js';
import { HandoffTokens } from '../../../shared/application/ports/handoff-tokens.port.js';
import { IdGenerator } from '../../../shared/application/ports/id-generator.port.js';
import { SecretCipher } from '../../../shared/application/ports/secret-cipher.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import type { AuthContext } from '../../../shared/application/auth-context.js';
import { WhatsAppChannel } from '../domain/whatsapp-channel.entity.js';
import { WhatsAppChannelRepository } from '../domain/whatsapp-channel.repository.js';
import {
  WhatsAppSignupNotConfiguredError,
  WhatsAppSignupRejectedError,
} from '../domain/embedded-signup.errors.js';
import { WhatsAppUnavailableError } from '../domain/whatsapp.errors.js';
import {
  EmbeddedSignupSettings,
  type EmbeddedSignupConfig,
} from './ports/embedded-signup-settings.port.js';
import {
  WhatsAppApiError,
  WhatsAppCloudApi,
} from './ports/whatsapp-cloud-api.port.js';
import type { WhatsAppPhoneNumberInfo } from './ports/whatsapp-cloud-api.port.js';

/** Saves (or replaces) a business's connected number, token encrypted. */
@Injectable()
export class WhatsAppChannelConnector {
  constructor(
    private readonly channels: WhatsAppChannelRepository,
    private readonly cipher: SecretCipher,
    private readonly transaction: TransactionRunner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  connect(
    tenantId: string,
    input: {
      readonly phoneNumberId: string;
      readonly wabaId: string | null;
      readonly accessToken: string;
      readonly info: WhatsAppPhoneNumberInfo;
    },
  ): Promise<WhatsAppChannel> {
    return this.transaction.run(async () => {
      const now = this.clock.now();
      const connection = {
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId,
        displayPhoneNumber: input.info.displayPhoneNumber,
        verifiedName: input.info.verifiedName,
        encryptedAccessToken: this.cipher.encrypt(
          input.accessToken,
          WhatsAppChannel.tokenContext(tenantId, input.phoneNumberId),
        ),
      };

      const existing = await this.channels.findByTenant(tenantId);
      const channel =
        existing ??
        WhatsAppChannel.connect(
          { id: this.ids.generate(), tenantId, ...connection },
          now,
        );

      if (existing) {
        existing.reconnect(connection, now);
      }

      await this.channels.save(channel);

      return channel;
    });
  }
}

export interface EmbeddedSignupResult {
  readonly code: string;
  readonly phoneNumberId: string;
  readonly wabaId: string;
}

/** The app asks for a link; the link opens Meta's signup in the browser. */
@Injectable()
export class StartEmbeddedSignupUseCase {
  constructor(
    private readonly settings: EmbeddedSignupSettings,
    private readonly tokens: HandoffTokens,
  ) {}

  execute(actor: AuthContext): { url: string; expiresInSeconds: number } {
    if (!this.settings.get()) {
      throw new WhatsAppSignupNotConfiguredError();
    }

    const token = this.tokens.issue({
      tenantId: actor.tenantId,
      userId: actor.userId,
      purpose: 'whatsapp-signup',
    });

    return {
      // In the fragment: it never reaches a server log or a Referer header.
      url: `${this.settings.pageBaseUrl}/api/v1/pages/whatsapp-signup#t=${token}`,
      expiresInSeconds: this.tokens.ttlSeconds,
    };
  }
}

@Injectable()
export class GetEmbeddedSignupConfigUseCase {
  constructor(private readonly settings: EmbeddedSignupSettings) {}

  execute(): EmbeddedSignupConfig {
    const config = this.settings.get();

    if (!config) {
      throw new WhatsAppSignupNotConfiguredError();
    }

    return config;
  }
}

/**
 * What the page sends back once the customer finishes Meta's flow: a one-time
 * `code` plus the ids Meta created. Following Meta's Tech Provider onboarding:
 * trade the code for the customer's token, check the token really reaches that
 * number, subscribe the app to the account's webhooks, register the number.
 */
@Injectable()
export class CompleteEmbeddedSignupUseCase {
  constructor(
    private readonly settings: EmbeddedSignupSettings,
    private readonly cloudApi: WhatsAppCloudApi,
    private readonly connector: WhatsAppChannelConnector,
  ) {}

  async execute(
    tenantId: string,
    input: EmbeddedSignupResult,
  ): Promise<WhatsAppChannel> {
    if (!this.settings.get()) {
      throw new WhatsAppSignupNotConfiguredError();
    }

    let accessToken: string;
    let info: WhatsAppPhoneNumberInfo;

    try {
      accessToken = await this.cloudApi.exchangeCode(input.code);
      // Proves the token can see this number before anything is changed.
      info = await this.cloudApi.getPhoneNumber(
        input.phoneNumberId,
        accessToken,
      );
      await this.cloudApi.subscribeApp(input.wabaId, accessToken);
      await this.cloudApi.registerPhone(input.phoneNumberId, accessToken);
    } catch (error) {
      if (error instanceof WhatsAppApiError) {
        throw error.failure === 'UNAVAILABLE'
          ? new WhatsAppUnavailableError()
          : new WhatsAppSignupRejectedError();
      }

      throw error;
    }

    return this.connector.connect(tenantId, {
      phoneNumberId: input.phoneNumberId,
      wabaId: input.wabaId,
      accessToken,
      info,
    });
  }
}
