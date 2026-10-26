import { Module } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module.js';
import { TenantsModule } from '../tenants/tenants.module.js';
import { BillingModule } from './billing.module.js';
import { SubscriptionNoticeLog } from './application/ports/subscription-notice-log.port.js';
import { SendSubscriptionRemindersUseCase } from './application/send-subscription-reminders.use-case.js';
import { TypeOrmSubscriptionNoticeLog } from './infrastructure/persistence/typeorm/typeorm-subscription-notice-log.js';
import { RemindersScheduler } from './reminders.scheduler.js';

/**
 * Billing's reminder emails. Kept apart from BillingModule because it needs
 * the owners' addresses from IdentityModule, and IdentityModule already
 * depends on BillingModule (for the subscription guard): a module that sits
 * on top of both avoids the cycle.
 */
@Module({
  imports: [BillingModule, IdentityModule, TenantsModule],
  providers: [
    { provide: SubscriptionNoticeLog, useClass: TypeOrmSubscriptionNoticeLog },
    SendSubscriptionRemindersUseCase,
    RemindersScheduler,
  ],
  exports: [SendSubscriptionRemindersUseCase],
})
export class SubscriptionRemindersModule {}
