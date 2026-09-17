import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import type {
  Page,
  PageRequest,
} from '../../../../shared/domain/pagination.js';
import type { Service } from '../../domain/service.entity.js';
import { ServiceRepository } from '../../domain/service.repository.js';
import type { ServiceStatus } from '../../domain/service-status.js';

export interface ListServicesInput extends PageRequest {
  readonly status?: ServiceStatus;
  readonly query?: string;
}

@Injectable()
export class ListServicesUseCase {
  constructor(private readonly services: ServiceRepository) {}

  async execute(
    actor: AuthContext,
    input: ListServicesInput,
  ): Promise<Page<Service>> {
    return this.services.list(
      actor.tenantId,
      { status: input.status, query: input.query?.trim() || undefined },
      { page: input.page, limit: input.limit },
    );
  }
}
