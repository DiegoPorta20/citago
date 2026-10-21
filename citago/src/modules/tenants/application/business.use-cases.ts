import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import { PhoneNumber } from '../../../shared/domain/phone-number.js';
import {
  WeeklySchedule,
  type ScheduleRangeInput,
} from '../../../shared/domain/weekly-schedule.js';
import { TenantNotAvailableError } from '../domain/errors/tenant-not-available.error.js';
import type { Tenant } from '../domain/tenant.entity.js';
import { TenantRepository } from '../domain/tenant.repository.js';

export interface BusinessView {
  readonly tenant: Tenant;
  readonly hours: WeeklySchedule;
}

export interface UpdateBusinessInput {
  readonly name?: string;
  readonly country?: string;
  readonly timezone?: string;
  readonly phone?: string | null;
  readonly email?: string | null;
}

@Injectable()
export class GetBusinessUseCase {
  constructor(private readonly tenants: TenantRepository) {}

  async execute(actor: AuthContext): Promise<BusinessView> {
    const [tenant, hours] = await Promise.all([
      this.tenants.findById(actor.tenantId),
      this.tenants.findHours(actor.tenantId),
    ]);

    if (!tenant) {
      throw new TenantNotAvailableError();
    }

    return { tenant, hours };
  }
}

@Injectable()
export class UpdateBusinessUseCase {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly transaction: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: UpdateBusinessInput,
  ): Promise<BusinessView> {
    return this.transaction.run(async () => {
      const tenant = await this.tenants.findById(actor.tenantId);

      if (!tenant) {
        throw new TenantNotAvailableError();
      }

      const now = this.clock.now();

      if (input.name !== undefined) {
        tenant.rename(input.name, now);
      }

      tenant.updateSettings(
        {
          country: input.country,
          timezone: input.timezone,
          phone:
            input.phone === undefined
              ? undefined
              : input.phone === null || input.phone.trim() === ''
                ? null
                : PhoneNumber.create(
                    input.phone,
                    input.country ?? tenant.country,
                  ).value,
          email:
            input.email === undefined
              ? undefined
              : input.email === null || input.email.trim() === ''
                ? null
                : input.email.trim(),
        },
        now,
      );

      await this.tenants.save(tenant);

      return { tenant, hours: await this.tenants.findHours(actor.tenantId) };
    });
  }
}

@Injectable()
export class ReplaceBusinessHoursUseCase {
  constructor(private readonly tenants: TenantRepository) {}

  async execute(
    actor: AuthContext,
    ranges: readonly ScheduleRangeInput[],
  ): Promise<BusinessView> {
    const tenant = await this.tenants.findById(actor.tenantId);

    if (!tenant) {
      throw new TenantNotAvailableError();
    }

    const hours = WeeklySchedule.fromInput(ranges);

    await this.tenants.replaceHours(actor.tenantId, hours);

    return { tenant, hours };
  }
}
