import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import type { Plan } from '../domain/plan.js';
import { PlanCode } from '../domain/plan.js';
import type { SubscriptionView } from '../application/billing.use-cases.js';
import { SubscriptionState } from '../domain/subscription.entity.js';

export class ChoosePlanRequestDto {
  @ApiProperty({ enum: PlanCode, example: PlanCode.Pro })
  @IsEnum(PlanCode)
  planCode: PlanCode;
}

export class PlanResponseDto {
  @ApiProperty({ enum: PlanCode })
  code: PlanCode;

  @ApiProperty({ example: 'Profesional' })
  name: string;

  @ApiProperty({
    example: '79.00',
    description: 'Decimal string, never a number.',
  })
  monthlyPrice: string;

  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({ example: 5 })
  maxStaff: number;

  static fromDomain(plan: Plan): PlanResponseDto {
    return {
      code: plan.code,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice.toDecimalString(),
      currency: plan.currency,
      maxStaff: plan.maxStaff,
    };
  }
}

export class SubscriptionResponseDto {
  @ApiProperty({ type: PlanResponseDto })
  plan: PlanResponseDto;

  @ApiProperty({
    enum: SubscriptionState,
    description:
      'TRIALING: everything works. EXPIRED: read-only until a plan is paid for.',
  })
  state: SubscriptionState;

  @ApiProperty({ example: '2026-10-31T05:00:00.000Z' })
  trialEndsAt: string;

  @ApiProperty({ example: 7, description: 'Whole days left, 0 once expired.' })
  daysLeft: number;

  static fromView(view: SubscriptionView): SubscriptionResponseDto {
    return {
      plan: PlanResponseDto.fromDomain(view.plan),
      state: view.state,
      trialEndsAt: view.trialEndsAt.toISOString(),
      daysLeft: view.daysLeft,
    };
  }
}
