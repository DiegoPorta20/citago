import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { ServiceNotFoundError } from '../../domain/errors/catalog.errors.js';
import type { Service } from '../../domain/service.entity.js';
import { ServiceRepository } from '../../domain/service.repository.js';

@Injectable()
export class GetServiceUseCase {
  constructor(private readonly services: ServiceRepository) {}

  async execute(actor: AuthContext, serviceId: string): Promise<Service> {
    const service = await this.services.findByIdForTenant(
      serviceId,
      actor.tenantId,
    );

    // Another tenant's service is indistinguishable from one that never
    // existed: same 404, no existence leak.
    if (!service) {
      throw new ServiceNotFoundError();
    }

    return service;
  }
}
