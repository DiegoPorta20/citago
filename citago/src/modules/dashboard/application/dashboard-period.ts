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

/** A year and a day. Longer than that is a report, not a dashboard. */
const MAX_PERIOD_DAYS = 366;

export interface PeriodInput {
  /** Local date `YYYY-MM-DD`. Defaults to today in the business time zone. */
  readonly from?: string;
  /** Local date `YYYY-MM-DD`, inclusive. Defaults to `from`. */
  readonly to?: string;
}

export interface ResolvedPeriod {
  readonly from: string;
  readonly to: string;
  readonly timezone: string;
  readonly currency: string;
  /** The instants the period covers: `[start of from, end of to)`. */
  readonly range: TimeRange;
}

/**
 * Turns "from Monday to Friday" into the instants the database understands.
 *
 * The dashboard is the place where rule TZ-2 matters most: a day's takings are
 * the takings of **the business's day**, not of a UTC day. A shop in Lima that
 * closes at 20:00 must not see its evening land in tomorrow's figures, so the
 * boundaries are computed with the tenant's own calendar, daylight saving
 * included, and only then handed to SQL.
 *
 * Both ends are **local dates**, inclusive, because that is how the question is
 * asked. `to` becomes the start of the next day so the range stays half-open.
 */
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
