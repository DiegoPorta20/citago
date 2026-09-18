import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../shared/application/ports/id-generator.port.js';
import { StaffMember } from '../domain/staff-member.entity.js';
import { StaffMemberStatus } from '../domain/staff-member-status.js';
import { StaffMemberNotFoundError } from '../domain/staff.errors.js';
import { StaffRepository } from '../domain/staff.repository.js';
import {
  WeeklySchedule,
  type ScheduleRangeInput,
} from '../domain/weekly-schedule.js';
import { StaffUserLinkValidator } from './staff-user-link.validator.js';

/**
 * Loads a staff member of the caller's tenant or fails with a 404.
 * Another tenant's id resolves to nothing, exactly like an unknown one.
 */
async function loadStaffMember(
  staff: StaffRepository,
  actor: AuthContext,
  staffMemberId: string,
): Promise<StaffMember> {
  const member = await staff.findByIdForTenant(staffMemberId, actor.tenantId);

  if (!member) {
    throw new StaffMemberNotFoundError();
  }

  return member;
}

@Injectable()
export class CreateStaffMemberUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly linkValidator: StaffUserLinkValidator,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: { readonly displayName: string; readonly userId?: string | null },
  ): Promise<StaffMember> {
    if (input.userId) {
      await this.linkValidator.assertLinkable(actor.tenantId, input.userId);
    }

    const member = StaffMember.create(
      {
        id: this.ids.generate(),
        tenantId: actor.tenantId,
        displayName: input.displayName,
        userId: input.userId ?? null,
      },
      this.clock.now(),
    );

    await this.staff.save(member);

    return member;
  }
}

@Injectable()
export class UpdateStaffMemberUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly linkValidator: StaffUserLinkValidator,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: {
      readonly staffMemberId: string;
      readonly displayName?: string;
      /** `null` unlinks the account. */
      readonly userId?: string | null;
    },
  ): Promise<StaffMember> {
    const member = await loadStaffMember(
      this.staff,
      actor,
      input.staffMemberId,
    );
    const now = this.clock.now();

    if (input.userId) {
      await this.linkValidator.assertLinkable(
        actor.tenantId,
        input.userId,
        member.id,
      );
    }

    if (input.displayName !== undefined) {
      member.rename(input.displayName, now);
    }
    if (input.userId !== undefined) {
      member.linkUser(input.userId, now);
    }

    await this.staff.save(member);

    return member;
  }
}

@Injectable()
export class SetStaffMemberStatusUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: AuthContext,
    input: {
      readonly staffMemberId: string;
      readonly status: StaffMemberStatus;
    },
  ): Promise<StaffMember> {
    const member = await loadStaffMember(
      this.staff,
      actor,
      input.staffMemberId,
    );
    const now = this.clock.now();

    if (input.status === StaffMemberStatus.Active) {
      member.activate(now);
    } else {
      member.deactivate(now);
    }

    await this.staff.save(member);

    return member;
  }
}

@Injectable()
export class ReplaceStaffScheduleUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * Replaces the whole weekly schedule. A full replacement is simpler and
   * safer than patching ranges one by one: the client always sends the week
   * as it should look, and validation sees all of it at once.
   *
   * Existing appointments are not touched: a schedule change applies to new
   * bookings.
   */
  async execute(
    actor: AuthContext,
    input: {
      readonly staffMemberId: string;
      readonly ranges: readonly ScheduleRangeInput[];
    },
  ): Promise<StaffMember> {
    const member = await loadStaffMember(
      this.staff,
      actor,
      input.staffMemberId,
    );

    member.replaceSchedule(
      WeeklySchedule.fromInput(input.ranges),
      this.clock.now(),
    );

    await this.staff.save(member);

    return member;
  }
}

@Injectable()
export class GetStaffMemberUseCase {
  constructor(private readonly staff: StaffRepository) {}

  execute(actor: AuthContext, staffMemberId: string): Promise<StaffMember> {
    return loadStaffMember(this.staff, actor, staffMemberId);
  }
}

@Injectable()
export class ListStaffMembersUseCase {
  constructor(private readonly staff: StaffRepository) {}

  execute(actor: AuthContext): Promise<StaffMember[]> {
    return this.staff.list(actor.tenantId);
  }
}
