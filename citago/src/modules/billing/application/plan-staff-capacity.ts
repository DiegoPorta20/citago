import { Injectable } from '@nestjs/common';

import { StaffCapacity } from '../../staff/application/ports/staff-capacity.port.js';
import { StaffLimitReachedError } from '../domain/billing.errors.js';
import { findPlan } from '../domain/plan.js';
import { SubscriptionRepository } from '../domain/subscription.repository.js';

/**
 * The chosen plan caps the active professionals (BI-7). It applies during the
 * trial too: picking a plan costs nothing yet, and a business too big for the
 * default one is told which to choose. Existing professionals are never
 * deactivated; the cap only stops adding more.
 */
@Injectable()
export class PlanStaffCapacity extends StaffCapacity {
  constructor(private readonly subscriptions: SubscriptionRepository) {
    super();
  }

  async assertCanAddOne(
    tenantId: string,
    currentActive: number,
  ): Promise<void> {
    const subscription = await this.subscriptions.findByTenant(tenantId);

    if (!subscription) {
      return;
    }

    const plan = findPlan(subscription.planCode);

    if (currentActive >= plan.maxStaff) {
      throw new StaffLimitReachedError(plan.name, plan.code, plan.maxStaff);
    }
  }
}
