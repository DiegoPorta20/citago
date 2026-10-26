import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { WhatsAppChannel } from '../domain/whatsapp-channel.entity.js';
import { WhatsAppChannelRepository } from '../domain/whatsapp-channel.repository.js';
import {
  WhatsAppCredentialsRejectedError,
  WhatsAppUnavailableError,
} from '../domain/whatsapp.errors.js';
import { WhatsAppChannelConnector } from './embedded-signup.use-cases.js';
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

@Injectable()
export class ConnectWhatsAppChannelUseCase {
  constructor(
    private readonly cloudApi: WhatsAppCloudApi,
    private readonly connector: WhatsAppChannelConnector,
  ) {}

  async execute(
    actor: AuthContext,
    input: ConnectWhatsAppInput,
  ): Promise<WhatsAppChannel> {
    const info = await this.verify(input);

    return this.connector.connect(actor.tenantId, {
      phoneNumberId: input.phoneNumberId,
      wabaId: input.wabaId ?? null,
      accessToken: input.accessToken,
      info,
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

  execute(actor: AuthContext): Promise<WhatsAppChannel | null> {
    return this.channels.findByTenant(actor.tenantId);
  }
}

@Injectable()
export class DisconnectWhatsAppChannelUseCase {
  constructor(private readonly channels: WhatsAppChannelRepository) {}

  execute(actor: AuthContext): Promise<void> {
    return this.channels.deleteForTenant(actor.tenantId);
  }
}
