import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import type {
  Page,
  PageRequest,
} from '../../../../shared/domain/pagination.js';
import type { Client } from '../../domain/client.entity.js';
import { ClientRepository } from '../../domain/client.repository.js';

export interface ListClientsInput extends PageRequest {
  /** Name prefix, or part of the phone number. */
  readonly query?: string;
}

@Injectable()
export class ListClientsUseCase {
  constructor(private readonly clients: ClientRepository) {}

  async execute(
    actor: AuthContext,
    input: ListClientsInput,
  ): Promise<Page<Client>> {
    return this.clients.list(
      actor.tenantId,
      { query: input.query?.trim() || undefined },
      { page: input.page, limit: input.limit },
    );
  }
}
