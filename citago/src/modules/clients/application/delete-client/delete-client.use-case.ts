import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { Clock } from '../../../../shared/application/ports/clock.port.js';
import { ClientRepository } from '../../domain/client.repository.js';
import { ClientNotFoundError } from '../../domain/errors/clients.errors.js';

/**
 * Removes a client from the everyday lists **without destroying history**
 * (rule CL-3): the row stays, so past appointments and sales keep their
 * customer, and the client can be restored.
 *
 * A request to erase personal data is a different operation (anonymization)
 * and will be added when that requirement exists.
 */
@Injectable()
export class DeleteClientUseCase {
  constructor(
    private readonly clients: ClientRepository,
    private readonly clock: Clock,
  ) {}

  async execute(actor: AuthContext, clientId: string): Promise<void> {
    const client = await this.clients.findByIdForTenant(
      clientId,
      actor.tenantId,
    );

    if (!client) {
      throw new ClientNotFoundError();
    }

    client.softDelete(this.clock.now());

    await this.clients.save(client);
  }
}
