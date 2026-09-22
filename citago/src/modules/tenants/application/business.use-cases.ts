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

/** The business as a screen shows it: its settings and when it opens. */
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

/**
 * Edits the business settings.
 *
 * The **currency is not editable**, on purpose. Every price in the catalogue is
 * stored as a bare amount and read as "in the tenant's currency", so switching
 * it would silently reprice the whole shop — a 25.00 haircut would become 25.00
 * of something else. Past sales would survive (they snapshot their own currency,
 * rule SA-6), but the catalogue would not. Changing it is a migration, not a
 * setting.
 *
 * The time zone **is** editable: it changes how future days are interpreted,
 * and existing instants are stored in UTC, so nothing is rewritten.
 */
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
          // The shop's own number is normalized like a client's (rule CL-1),
          // with the country it is being saved with.
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

/**
 * Replaces the opening hours.
 *
 * These hours describe the shop; they do **not** gate bookings. What decides
 * whether an appointment fits is the staff member's own weekly schedule (rule
 * AP-14), which is the only timetable a barber actually works to. Two sources
 * of truth for the same answer would eventually disagree, and the agenda is the
 * one the business feels.
 */
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
