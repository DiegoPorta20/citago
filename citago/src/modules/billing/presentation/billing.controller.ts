import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { AllowWhenExpired } from '../../../shared/presentation/decorators/allow-when-expired.decorator.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator.js';
import {
  CancelSubscriptionUseCase,
  ChoosePlanUseCase,
  GetSubscriptionUseCase,
  ListPlansUseCase,
  StartCheckoutUseCase,
} from '../application/billing.use-cases.js';
import {
  CheckoutSessionResponseDto,
  ChoosePlanRequestDto,
  PlanResponseDto,
  StartCheckoutRequestDto,
  SubscriptionResponseDto,
} from './billing.dto.js';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(
    private readonly listPlans: ListPlansUseCase,
    private readonly getSubscription: GetSubscriptionUseCase,
    private readonly choosePlan: ChoosePlanUseCase,
    private readonly startCheckout: StartCheckoutUseCase,
    private readonly cancelSubscription: CancelSubscriptionUseCase,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'The plans CitaGo sells' })
  @ApiOkResponse({ type: PlanResponseDto, isArray: true })
  plans(): PlanResponseDto[] {
    return this.listPlans
      .execute()
      .map((plan) => PlanResponseDto.fromDomain(plan));
  }

  @Get('subscription')
  @ApiOperation({
    summary: 'Trial, plan and payment state of the current business',
    description:
      'Every role can read it: an expired subscription affects all of them. Asks the payment gateway when a paid period has just run out.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  async subscription(
    @CurrentAuth() auth: AuthContext,
  ): Promise<SubscriptionResponseDto> {
    return SubscriptionResponseDto.fromView(
      await this.getSubscription.execute(auth),
    );
  }

  @Put('subscription/plan')
  @Roles(UserRole.Owner)
  @AllowWhenExpired()
  @ApiOperation({
    summary: 'Choose the plan the business wants, without paying yet',
    description:
      'Only while not paying: a paying business changes plan by paying for the new one (422 PLAN_CHANGE_REQUIRES_PAYMENT). Works after the trial ends.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  async chooseSubscriptionPlan(
    @CurrentAuth() auth: AuthContext,
    @Body() body: ChoosePlanRequestDto,
  ): Promise<SubscriptionResponseDto> {
    return SubscriptionResponseDto.fromView(
      await this.choosePlan.execute(auth, body.planCode),
    );
  }

  @Post('checkout/session')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Owner)
  @AllowWhenExpired()
  @ApiOperation({
    summary: 'Link to pay for a plan (Culqi card form)',
    description:
      'Returns a URL for the browser. 503 PAYMENTS_NOT_CONFIGURED until Culqi is set up; 409 ALREADY_SUBSCRIBED when that plan is already paid and active.',
  })
  @ApiOkResponse({ type: CheckoutSessionResponseDto })
  checkoutSession(
    @CurrentAuth() auth: AuthContext,
    @Body() body: StartCheckoutRequestDto,
  ): Promise<CheckoutSessionResponseDto> {
    return this.startCheckout.execute(auth, body.planCode);
  }

  @Delete('subscription')
  @Roles(UserRole.Owner)
  @AllowWhenExpired()
  @ApiOperation({
    summary: 'Stop the monthly charge',
    description:
      'The paid period stays usable until it ends. 422 NOT_PAYING if there is nothing to cancel.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  async cancel(
    @CurrentAuth() auth: AuthContext,
  ): Promise<SubscriptionResponseDto> {
    return SubscriptionResponseDto.fromView(
      await this.cancelSubscription.execute(auth),
    );
  }
}
