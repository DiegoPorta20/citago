import { Module } from '@nestjs/common';

import { StaffCapacity } from '../staff/application/ports/staff-capacity.port.js';
import { TenantsModule } from '../tenants/tenants.module.js';
import {
  AssertSubscriptionAccessUseCase,
  CancelSubscriptionUseCase,
  ChoosePlanUseCase,
  CompleteCheckoutUseCase,
  GetCheckoutConfigUseCase,
  GetSubscriptionUseCase,
  HandleGatewayEventUseCase,
  ListPlansUseCase,
  StartCheckoutUseCase,
  SubscriptionSync,
} from './application/billing.use-cases.js';
import { PlanStaffCapacity } from './application/plan-staff-capacity.js';
import { PaymentProvider } from './application/ports/payment-provider.port.js';
import { PaymentSettings } from './application/ports/payment-settings.port.js';
import { SubscriptionRepository } from './domain/subscription.repository.js';
import { ConfigPaymentSettings } from './infrastructure/culqi/config-payment-settings.js';
import { CulqiPaymentProvider } from './infrastructure/culqi/culqi-payment-provider.js';
import { TypeOrmSubscriptionRepository } from './infrastructure/persistence/typeorm/typeorm-subscription.repository.js';
import { BillingController } from './presentation/billing.controller.js';
import { CheckoutController } from './presentation/checkout.controller.js';
import { CulqiWebhookController } from './presentation/culqi-webhook.controller.js';

@Module({
  imports: [TenantsModule],
  controllers: [BillingController, CheckoutController, CulqiWebhookController],
  providers: [
    {
      provide: SubscriptionRepository,
      useClass: TypeOrmSubscriptionRepository,
    },
    { provide: PaymentProvider, useClass: CulqiPaymentProvider },
    { provide: PaymentSettings, useClass: ConfigPaymentSettings },
    { provide: StaffCapacity, useClass: PlanStaffCapacity },
    SubscriptionSync,
    ListPlansUseCase,
    GetSubscriptionUseCase,
    ChoosePlanUseCase,
    AssertSubscriptionAccessUseCase,
    StartCheckoutUseCase,
    GetCheckoutConfigUseCase,
    CompleteCheckoutUseCase,
    CancelSubscriptionUseCase,
    HandleGatewayEventUseCase,
  ],
  // IdentityModule registers SubscriptionGuard as an APP_GUARD right after the
  // JWT and roles guards (it needs the auth context they set), so it gets the
  // use case from here.
  exports: [
    SubscriptionRepository,
    SubscriptionSync,
    AssertSubscriptionAccessUseCase,
    StaffCapacity,
  ],
})
export class BillingModule {}
