import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { Clock } from '../../../../shared/application/ports/clock.port.js';
import { Money } from '../../../../shared/domain/money.js';
import {
  DuplicateServiceNameError,
  ServiceNotFoundError,
} from '../../domain/errors/catalog.errors.js';
import type { Service } from '../../domain/service.entity.js';
import { ServiceRepository } from '../../domain/service.repository.js';

export interface UpdateServiceInput {
  readonly serviceId: string;
  readonly name?: string;
  readonly description?: string | null;
  readonly durationMinutes?: number;
  readonly price?: string;
}

@Injectable()
export class UpdateServiceUseCase {
  constructor(
    private readonly services: ServiceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: UpdateServiceInput,
  ): Promise<Service> {
    const service = await this.services.findByIdForTenant(
      input.serviceId,
      actor.tenantId,
    );

    if (!service) {
      throw new ServiceNotFoundError();
    }

    const name = input.name?.trim();

    if (
      name !== undefined &&
      (await this.services.existsActiveWithName(
        actor.tenantId,
        name,
        service.id,
      ))
    ) {
      throw new DuplicateServiceNameError(name);
    }

    service.update(
      {
        name,
        description: input.description,
        durationMinutes: input.durationMinutes,
        price:
          input.price === undefined
            ? undefined
            : Money.fromDecimalString(input.price),
      },
      this.clock.now(),
    );

    await this.services.save(service);

    return service;
  }
}
