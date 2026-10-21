import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { Clock } from '../../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../../shared/application/ports/id-generator.port.js';
import { Money } from '../../../../shared/domain/money.js';
import { DuplicateServiceNameError } from '../../domain/errors/catalog.errors.js';
import { Service } from '../../domain/service.entity.js';
import { ServiceRepository } from '../../domain/service.repository.js';

export interface CreateServiceInput {
  readonly name: string;
  readonly description?: string | null;
  readonly durationMinutes: number;
  readonly price: string;
}

@Injectable()
export class CreateServiceUseCase {
  constructor(
    private readonly services: ServiceRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: CreateServiceInput,
  ): Promise<Service> {
    const name = input.name.trim();

    if (await this.services.existsActiveWithName(actor.tenantId, name)) {
      throw new DuplicateServiceNameError(name);
    }

    const service = Service.create(
      {
        id: this.ids.generate(),
        tenantId: actor.tenantId,
        name,
        description: input.description,
        durationMinutes: input.durationMinutes,
        price: Money.fromDecimalString(input.price),
      },
      this.clock.now(),
    );

    await this.services.save(service);

    return service;
  }
}
