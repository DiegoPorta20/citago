import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { Clock } from '../../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../../shared/application/ports/id-generator.port.js';
import { Email } from '../../../../shared/domain/email.js';
import { Client } from '../../domain/client.entity.js';
import { ClientRepository } from '../../domain/client.repository.js';
import {
  ClientDeletedWithSamePhoneError,
  ClientPhoneAlreadyRegisteredError,
} from '../../domain/errors/clients.errors.js';
import { ClientPhoneNormalizer } from '../client-phone-normalizer.js';

export interface CreateClientInput {
  readonly name: string;
  /** As typed: `999 999 999`, `+51 999 999 999`… normalized to E.164 here. */
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly notes?: string | null;
}

/**
 * Registers a customer.
 *
 * The phone is the customer's identity (it is how WhatsApp will find them), so
 * before creating anything this checks whether the number already belongs to
 * someone — including a deleted client, which is offered for restore instead of
 * being silently duplicated (decision F4).
 */
@Injectable()
export class CreateClientUseCase {
  constructor(
    private readonly clients: ClientRepository,
    private readonly phoneNormalizer: ClientPhoneNormalizer,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(actor: AuthContext, input: CreateClientInput): Promise<Client> {
    const phone = await this.phoneNormalizer.normalize(
      actor.tenantId,
      input.phone,
    );

    if (phone) {
      const existing = await this.clients.findByPhone(actor.tenantId, phone);

      if (existing?.isDeleted) {
        throw new ClientDeletedWithSamePhoneError(existing.id);
      }
      if (existing) {
        throw new ClientPhoneAlreadyRegisteredError(existing.id);
      }
    }

    const client = Client.create(
      {
        id: this.ids.generate(),
        tenantId: actor.tenantId,
        name: input.name,
        phone: phone ?? null,
        email: input.email ? Email.create(input.email) : null,
        notes: input.notes,
      },
      this.clock.now(),
    );

    await this.clients.save(client);

    return client;
  }
}
