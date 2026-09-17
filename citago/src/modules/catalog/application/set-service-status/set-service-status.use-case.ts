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

/**
 * Activates or deactivates a service.
 *
 * One use case for both directions because it is one business action — "is this
 * still on the menu?" — and splitting it would duplicate the lookup, the
 * tenant check and the save.
 *
 * A service is never deleted: deactivating keeps every past appointment and
 * sale intact (rule CA-3).
 */
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
