import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../shared/application/ports/id-generator.port.js';
import { SecretCipher } from '../../../shared/application/ports/secret-cipher.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import { WhatsAppChannel } from '../domain/whatsapp-channel.entity.js';
import { WhatsAppChannelRepository } from '../domain/whatsapp-channel.repository.js';
import {
  WhatsAppCredentialsRejectedError,
  WhatsAppUnavailableError,
} from '../domain/whatsapp.errors.js';
import {
  WhatsAppApiError,
  WhatsAppCloudApi,
  type WhatsAppPhoneNumberInfo,
} from './ports/whatsapp-cloud-api.port.js';

export interface ConnectWhatsAppInput {
  readonly phoneNumberId: string;
  readonly accessToken: string;
  readonly wabaId?: string | null;
}

/**
 * Connects the business's WhatsApp number manually: the owner pastes the
 * phone number id and a token from Meta's dashboard. (Meta's Embedded Signup,
 * decision D2, replaces this later without changing the stored shape.)
 *
 * The credentials are checked against Meta **before** anything is stored. That
 * also stops a business from claiming a number it does not control, which
 * would route someone else's customers into its inbox.
 *
 * Connecting again replaces the number and the token.
 */
@Injectable()
export class ConnectWhatsAppChannelUseCase {
  constructor(
    private readonly channels: WhatsAppChannelRepository,
    private readonly cloudApi: WhatsAppCloudApi,
    private readonly cipher: SecretCipher,
    private readonly transaction: TransactionRunner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: ConnectWhatsAppInput,
  ): Promise<WhatsAppChannel> {
    const info = await this.verify(input);

    return this.transaction.run(async () => {
      const now = this.clock.now();
      const connection = {
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId ?? null,
        displayPhoneNumber: info.displayPhoneNumber,
        verifiedName: info.verifiedName,
        encryptedAccessToken: this.cipher.encrypt(
          input.accessToken,
          WhatsAppChannel.tokenContext(actor.tenantId, input.phoneNumberId),
        ),
      };

      const existing = await this.channels.findByTenant(actor.tenantId);
      const channel =
        existing ??
        WhatsAppChannel.connect(
          { id: this.ids.generate(), tenantId: actor.tenantId, ...connection },
          now,
        );

      if (existing) {
        existing.reconnect(connection, now);
      }

      await this.channels.save(channel);

      return channel;
    });
  }

  private async verify(
    input: ConnectWhatsAppInput,
  ): Promise<WhatsAppPhoneNumberInfo> {
    try {
      return await this.cloudApi.getPhoneNumber(
        input.phoneNumberId,
        input.accessToken,
      );
    } catch (error) {
      if (error instanceof WhatsAppApiError) {
        throw error.failure === 'UNAVAILABLE'
          ? new WhatsAppUnavailableError()
          : new WhatsAppCredentialsRejectedError();
      }

      throw error;
    }
  }
}

@Injectable()
export class GetWhatsAppChannelUseCase {
  constructor(private readonly channels: WhatsAppChannelRepository) {}

  /** `null` when the business has not connected WhatsApp. */
  execute(actor: AuthContext): Promise<WhatsAppChannel | null> {
    return this.channels.findByTenant(actor.tenantId);
  }
}

/**
 * Forgets the number and **deletes the token**. Conversations and messages
 * stay: they are the business's history, not the channel's.
 *
 * Idempotent: disconnecting twice is not an error.
 */
@Injectable()
export class DisconnectWhatsAppChannelUseCase {
  constructor(private readonly channels: WhatsAppChannelRepository) {}

  execute(actor: AuthContext): Promise<void> {
    return this.channels.deleteForTenant(actor.tenantId);
  }
}
