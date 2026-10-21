import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { Clock } from '../../../../shared/application/ports/clock.port.js';
import { ServiceNotFoundError } from '../../domain/errors/catalog.errors.js';
import type { Service } from '../../domain/service.entity.js';
import { ServiceRepository } from '../../domain/service.repository.js';
import { ServiceStatus } from '../../domain/service-status.js';

export interface SetServiceStatusInput {
  readonly serviceId: string;
  readonly status: ServiceStatus;
}

@Injectable()
export class SetServiceStatusUseCase {
  constructor(
    private readonly services: ServiceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: SetServiceStatusInput,
  ): Promise<Service> {
    const service = await this.services.findByIdForTenant(
      input.serviceId,
      actor.tenantId,
    );

    if (!service) {
      throw new ServiceNotFoundError();
    }

    const now = this.clock.now();

    if (input.status === ServiceStatus.Active) {
      service.activate(now);
    } else {
      service.deactivate(now);
    }

    await this.services.save(service);

    return service;
  }
}
