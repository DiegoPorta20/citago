import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../shared/application/ports/id-generator.port.js';
import { TimeRange } from '../../../shared/domain/time-range.js';
import { StaffTimeOff } from '../domain/staff-time-off.entity.js';
import {
  InvalidTimeOffError,
  StaffMemberNotFoundError,
  TimeOffNotFoundError,
} from '../domain/staff.errors.js';
import { StaffRepository } from '../domain/staff.repository.js';

/** Bounds a listing query so nobody can ask for ten years of time off at once. */
const MAX_LIST_RANGE_DAYS = 366;

@Injectable()
export class AddStaffTimeOffUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /**
   * Existing appointments inside the new time off are **not** cancelled: that
   * is a conversation with each client, not an automatic side effect. The time
   * off only blocks new bookings.
   */
  async execute(
    actor: AuthContext,
    input: {
      readonly staffMemberId: string;
      readonly startsAt: Date;
      readonly endsAt: Date;
      readonly reason?: string | null;
    },
  ): Promise<StaffTimeOff> {
    const member = await this.staff.findByIdForTenant(
      input.staffMemberId,
      actor.tenantId,
    );

    if (!member) {
      throw new StaffMemberNotFoundError();
    }

    const timeOff = StaffTimeOff.create(
      {
        id: this.ids.generate(),
        tenantId: actor.tenantId,
        staffMemberId: member.id,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        reason: input.reason,
      },
      this.clock.now(),
    );

    await this.staff.saveTimeOff(timeOff);

    return timeOff;
  }
}

@Injectable()
export class RemoveStaffTimeOffUseCase {
  constructor(private readonly staff: StaffRepository) {}

  async execute(
    actor: AuthContext,
    input: { readonly staffMemberId: string; readonly timeOffId: string },
  ): Promise<void> {
    const timeOff = await this.staff.findTimeOffForTenant(
      input.timeOffId,
      actor.tenantId,
    );

    // The time off must belong to this tenant *and* to the staff member in the
    // URL: a valid id under the wrong parent is still "not found".
    if (!timeOff || timeOff.staffMemberId !== input.staffMemberId) {
      throw new TimeOffNotFoundError();
    }

    await this.staff.deleteTimeOff(timeOff.id, actor.tenantId);
  }
}

@Injectable()
export class ListStaffTimeOffUseCase {
  constructor(private readonly staff: StaffRepository) {}

  async execute(
    actor: AuthContext,
    input: {
      readonly staffMemberId: string;
      readonly from: Date;
      readonly to: Date;
    },
  ): Promise<StaffTimeOff[]> {
    const member = await this.staff.findByIdForTenant(
      input.staffMemberId,
      actor.tenantId,
    );

    if (!member) {
      throw new StaffMemberNotFoundError();
    }

    const range = TimeRange.of(input.from, input.to);

    if (range.durationMinutes > MAX_LIST_RANGE_DAYS * 24 * 60) {
      throw new InvalidTimeOffError(
        `a listing cannot span more than ${MAX_LIST_RANGE_DAYS} days`,
      );
    }

    return this.staff.listTimeOff(actor.tenantId, member.id, range);
  }
}
