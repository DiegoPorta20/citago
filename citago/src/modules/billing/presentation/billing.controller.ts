import { Body, Controller, Get, Put } from '@nestjs/common';
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
  ChoosePlanUseCase,
  GetSubscriptionUseCase,
  ListPlansUseCase,
} from '../application/billing.use-cases.js';
import {
  ChoosePlanRequestDto,
  PlanResponseDto,
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
    summary: 'Trial and plan of the current business',
    description:
      'Every role can read it: an expired trial affects all of them.',
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
    summary: 'Choose the plan the business wants',
    description:
      'Records the choice; nothing is charged yet. Works after the trial ends, so an expired business can still pick a plan.',
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
}
