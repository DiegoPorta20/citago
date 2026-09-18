import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { Clock } from '../../../../shared/application/ports/clock.port.js';
import type { Client } from '../../domain/client.entity.js';
import { ClientRepository } from '../../domain/client.repository.js';
import { ClientNotFoundError } from '../../domain/errors/clients.errors.js';

/**
 * Brings a deleted client back with all their history.
 *
 * This is the other half of decision F4: when a phone number collides with a
 * deleted client, the app offers this instead of creating a duplicate.
 *
 * Idempotent: restoring a client that is not deleted changes nothing.
 */
@Injectable()
export class RestoreClientUseCase {
  constructor(
    private readonly clients: ClientRepository,
    private readonly clock: Clock,
  ) {}

  async execute(actor: AuthContext, clientId: string): Promise<Client> {
    const client = await this.clients.findByIdForTenant(
      clientId,
      actor.tenantId,
      { includeDeleted: true },
    );

    if (!client) {
      throw new ClientNotFoundError();
    }

    if (client.isDeleted) {
      client.restore(this.clock.now());
      await this.clients.save(client);
    }

    return client;
  }
}
