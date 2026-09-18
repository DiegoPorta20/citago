import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { Clock } from '../../../../shared/application/ports/clock.port.js';
import { Email } from '../../../../shared/domain/email.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { Client } from '../../domain/client.entity.js';
import { ClientRepository } from '../../domain/client.repository.js';
import {
  ClientDeletedWithSamePhoneError,
  ClientNotFoundError,
  ClientPhoneAlreadyRegisteredError,
} from '../../domain/errors/clients.errors.js';
import { ClientPhoneNormalizer } from '../client-phone-normalizer.js';

export interface UpdateClientInput {
  readonly clientId: string;
  readonly name?: string;
  /** `null` or `""` clears the phone. */
  readonly phone?: string | null;
  /** `null` or `""` clears the email. */
  readonly email?: string | null;
  readonly notes?: string | null;
}

@Injectable()
export class UpdateClientUseCase {
  constructor(
    private readonly clients: ClientRepository,
    private readonly phoneNormalizer: ClientPhoneNormalizer,
    private readonly clock: Clock,
  ) {}

  async execute(actor: AuthContext, input: UpdateClientInput): Promise<Client> {
    const client = await this.clients.findByIdForTenant(
      input.clientId,
      actor.tenantId,
    );

    // Deleted clients and other tenants' clients are all "not found" here.
    if (!client) {
      throw new ClientNotFoundError();
    }

    const phone = await this.phoneNormalizer.normalize(
      actor.tenantId,
      input.phone,
    );

    // Only a *new* number needs checking: keeping one's own is not a clash.
    const phoneChanged =
      phone != null && !(client.phone?.equals(phone) ?? false);

    if (phoneChanged) {
      await this.assertPhoneFree(actor.tenantId, phone, client.id);
    }

    client.update(
      {
        name: input.name,
        phone,
        email: this.toEmail(input.email),
        notes: input.notes,
      },
      this.clock.now(),
    );

    await this.clients.save(client);

    return client;
  }

  private async assertPhoneFree(
    tenantId: string,
    phone: PhoneNumber,
    ownId: string,
  ): Promise<void> {
    const owner = await this.clients.findByPhone(tenantId, phone);

    if (!owner || owner.id === ownId) {
      return;
    }
    if (owner.isDeleted) {
      throw new ClientDeletedWithSamePhoneError(owner.id);
    }

    throw new ClientPhoneAlreadyRegisteredError(owner.id);
  }

  private toEmail(raw: string | null | undefined): Email | null | undefined {
    if (raw === undefined) {
      return undefined;
    }
    if (raw === null || raw.trim().length === 0) {
      return null;
    }

    return Email.create(raw);
  }
}
