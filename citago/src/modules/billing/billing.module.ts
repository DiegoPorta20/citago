import { Module } from '@nestjs/common';

import {
  AssertSubscriptionAccessUseCase,
  ChoosePlanUseCase,
  GetSubscriptionUseCase,
  ListPlansUseCase,
} from './application/billing.use-cases.js';
import { SubscriptionRepository } from './domain/subscription.repository.js';
import { TypeOrmSubscriptionRepository } from './infrastructure/persistence/typeorm/typeorm-subscription.repository.js';
import { BillingController } from './presentation/billing.controller.js';

@Module({
  controllers: [BillingController],
  providers: [
    {
      provide: SubscriptionRepository,
      useClass: TypeOrmSubscriptionRepository,
    },
    ListPlansUseCase,
    GetSubscriptionUseCase,
    ChoosePlanUseCase,
    AssertSubscriptionAccessUseCase,
  ],
  // IdentityModule registers SubscriptionGuard as an APP_GUARD right after the
  // JWT and roles guards (it needs the auth context they set), so it gets the
  // use case from here.
  exports: [SubscriptionRepository, AssertSubscriptionAccessUseCase],
})
export class BillingModule {}
