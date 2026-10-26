import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  Matches,
  MaxLength,
} from 'class-validator';

import type { SubscriptionView } from '../application/billing.use-cases.js';
import type { Plan } from '../domain/plan.js';
import { PlanCode } from '../domain/plan.js';
import { SubscriptionState } from '../domain/subscription.entity.js';

export class ChoosePlanRequestDto {
  @ApiProperty({ enum: PlanCode, example: PlanCode.Pro })
  @IsEnum(PlanCode)
  planCode: PlanCode;
}

export class StartCheckoutRequestDto {
  @ApiPropertyOptional({
    enum: PlanCode,
    description: 'Defaults to the plan already chosen.',
  })
  @IsOptional()
  @IsEnum(PlanCode)
  planCode?: PlanCode;
}

export class CompleteCheckoutRequestDto {
  @ApiProperty({ example: 'tkn_test_abc123', description: 'Culqi card token.' })
  @Matches(/^[A-Za-z0-9_-]{6,80}$/, { message: 'tokenId is not a card token' })
  tokenId: string;

  @ApiProperty({ example: 'dueno@barberia.pe' })
  @IsEmail()
  @MaxLength(160)
  email: string;
}

export class CheckoutSessionResponseDto {
  @ApiProperty({
    description:
      'Open it in the browser. The token lives in the fragment (#t=…).',
  })
  url: string;

  @ApiProperty({ example: 900 })
  expiresInSeconds: number;
}

export class CheckoutConfigResponseDto {
  @ApiProperty({ example: 'pk_test_xxx' })
  publicKey: string;

  @ApiProperty({ type: () => PlanResponseDto })
  plan: PlanResponseDto;
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
      'TRIALING and ACTIVE: everything works. PAST_DUE: the renewal has not gone through yet; still works for a few days. EXPIRED: read-only until a plan is paid for.',
  })
  state: SubscriptionState;

  @ApiProperty({ example: '2026-10-31T05:00:00.000Z' })
  trialEndsAt: string;

  @ApiProperty({
    nullable: true,
    example: '2026-11-24T05:00:00.000Z',
    description: 'End of the period already paid. Null while on the trial.',
  })
  currentPeriodEnd: string | null;

  @ApiProperty({
    description:
      'True when the card will be charged again. False once cancelled.',
  })
  renews: boolean;

  @ApiProperty({
    example: 7,
    description: 'Whole days left in the trial or paid period, 0 once over.',
  })
  daysLeft: number;

  @ApiProperty({
    description: 'Whether this plan can be paid online right now.',
  })
  paymentsEnabled: boolean;

  static fromView(view: SubscriptionView): SubscriptionResponseDto {
    return {
      plan: PlanResponseDto.fromDomain(view.plan),
      state: view.state,
      trialEndsAt: view.trialEndsAt.toISOString(),
      currentPeriodEnd: view.currentPeriodEnd?.toISOString() ?? null,
      renews: view.renews,
      daysLeft: view.daysLeft,
      paymentsEnabled: view.paymentsEnabled,
    };
  }
}
