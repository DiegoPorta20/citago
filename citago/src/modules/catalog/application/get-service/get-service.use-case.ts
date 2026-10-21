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

    if (!service) {
      throw new ServiceNotFoundError();
    }

    return service;
  }
}
