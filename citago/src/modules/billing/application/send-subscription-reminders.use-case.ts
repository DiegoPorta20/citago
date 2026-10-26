import { Injectable, Logger } from '@nestjs/common';

import { Clock } from '../../../shared/application/ports/clock.port.js';
import {
  EmailDeliveryError,
  EmailSender,
} from '../../../shared/application/ports/email-sender.port.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { MembershipRepository } from '../../identity/domain/membership.repository.js';
import { UserRepository } from '../../identity/domain/user.repository.js';
import { TenantRepository } from '../../tenants/domain/tenant.repository.js';
import { NOTICE_LOOKBACK_DAYS, noticeFor } from '../domain/notice.js';
import { SubscriptionRepository } from '../domain/subscription.repository.js';
import { SubscriptionNoticeLog } from './ports/subscription-notice-log.port.js';
import { SubscriptionSync } from './billing.use-cases.js';
import { renderNotice } from './subscription-notices.js';

const LOOKAHEAD_DAYS = 3;

export interface ReminderRunSummary {
  readonly examined: number;
  readonly sent: number;
}

/**
 * Emails the owners about the trial and about payments that did not go
 * through. Safe to run as often as you like and from several instances: what
 * is due is a pure function of the subscription and the clock, and each notice
 * is claimed in the database before it is sent.
 */
@Injectable()
export class SendSubscriptionRemindersUseCase {
  private readonly logger = new Logger(SendSubscriptionRemindersUseCase.name);

  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly sync: SubscriptionSync,
    private readonly log: SubscriptionNoticeLog,
    private readonly tenants: TenantRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserRepository,
    private readonly email: EmailSender,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<ReminderRunSummary> {
    const now = this.clock.now();
    const candidates = await this.subscriptions.findNearBoundary(
      now,
      NOTICE_LOOKBACK_DAYS + 3,
      LOOKAHEAD_DAYS,
    );
    let sent = 0;

    for (const subscription of candidates) {
      try {
        // A renewal may have gone through without anyone telling us; do not
        // scare someone whose card just worked.
        if (subscription.mayHaveRenewedAt(now)) {
          await this.sync.syncNow(subscription);
        }

        const notice = noticeFor(subscription, now);

        if (!notice) {
          continue;
        }
        if (!(await this.log.claim(subscription.id, notice, now))) {
          continue;
        }

        const delivered = await this.deliver(
          subscription.tenantId,
          notice.kind,
          {
            daysLeft: subscription.daysLeftAt(now),
          },
        );

        if (delivered === 0) {
          // Nobody to tell, or every attempt failed for a reason worth
          // retrying: give the claim back so the next run tries again.
          await this.log.release(subscription.id, notice);
        }
        sent += delivered;
      } catch (error) {
        this.logger.error(
          `Reminder for subscription ${subscription.id} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return { examined: candidates.length, sent };
  }

  private async deliver(
    tenantId: string,
    kind: Parameters<typeof renderNotice>[0],
    context: { daysLeft: number },
  ): Promise<number> {
    const [tenant, memberships] = await Promise.all([
      this.tenants.findById(tenantId),
      this.memberships.listByTenant(tenantId),
    ]);

    if (!tenant) {
      return 0;
    }

    const ownerIds = memberships
      .filter((m) => m.isActive && m.role === UserRole.Owner)
      .map((m) => m.userId);
    const owners = await this.users.findManyByIds(ownerIds);
    const message = renderNotice(kind, {
      businessName: tenant.name,
      daysLeft: context.daysLeft,
    });
    let delivered = 0;

    for (const owner of owners) {
      try {
        await this.email.send({ to: owner.email.value, ...message });
        delivered += 1;
      } catch (error) {
        if (error instanceof EmailDeliveryError && !error.retryable) {
          // A bounced address will not get better; do not retry it forever.
          this.logger.warn(`Could not email ${tenantId}'s owner (permanent).`);
          delivered += 1;
        } else {
          this.logger.warn(`Could not email ${tenantId}'s owner (will retry).`);
        }
      }
    }

    return delivered;
  }
}
