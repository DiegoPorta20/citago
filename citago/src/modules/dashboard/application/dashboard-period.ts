import { Injectable } from '@nestjs/common';

import { Clock } from '../../../shared/application/ports/clock.port.js';
import { BusinessCalendar } from '../../../shared/domain/business-calendar.js';
import { TimeRange } from '../../../shared/domain/time-range.js';
import { TenantNotAvailableError } from '../../tenants/domain/errors/tenant-not-available.error.js';
import { TenantRepository } from '../../tenants/domain/tenant.repository.js';
import {
  DashboardPeriodInvertedError,
  DashboardRangeTooWideError,
} from './dashboard.errors.js';

const MAX_PERIOD_DAYS = 366;

export interface PeriodInput {
  readonly from?: string;
  readonly to?: string;
}

export interface ResolvedPeriod {
  readonly from: string;
  readonly to: string;
  readonly timezone: string;
  readonly currency: string;
  readonly range: TimeRange;
}

@Injectable()
export class DashboardPeriod {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly clock: Clock,
  ) {}

  async resolve(
    tenantId: string,
    input: PeriodInput = {},
  ): Promise<ResolvedPeriod> {
    const tenant = await this.tenants.findById(tenantId);

    if (!tenant) {
      throw new TenantNotAvailableError();
    }

    const calendar = new BusinessCalendar(tenant.timezone);
    const today = calendar.localDateOf(this.clock.now());
    const from = input.from ?? today;
    const to = input.to ?? from;

    if (to < from) {
      throw new DashboardPeriodInvertedError();
    }

    const range = TimeRange.of(
      calendar.dayRange(from).start,
      calendar.dayRange(to).end,
    );

    if (range.durationMinutes > MAX_PERIOD_DAYS * 24 * 60) {
      throw new DashboardRangeTooWideError(MAX_PERIOD_DAYS);
    }

    return {
      from,
      to,
      timezone: tenant.timezone,
      currency: tenant.currency,
      range,
    };
  }
}
