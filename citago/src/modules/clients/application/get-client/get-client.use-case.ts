import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import type { Client } from '../../domain/client.entity.js';
import { ClientRepository } from '../../domain/client.repository.js';
import { ClientNotFoundError } from '../../domain/errors/clients.errors.js';

@Injectable()
export class GetClientUseCase {
  constructor(private readonly clients: ClientRepository) {}

  async execute(actor: AuthContext, clientId: string): Promise<Client> {
    const client = await this.clients.findByIdForTenant(
      clientId,
      actor.tenantId,
    );

    // Unknown, deleted or belonging to another tenant: the same 404 for all
    // three, so the response never confirms that an id exists elsewhere.
    if (!client) {
      throw new ClientNotFoundError();
    }

    return client;
  }
}
