import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { HandoffTokens } from '../../../shared/application/ports/handoff-tokens.port.js';
import { Public } from '../../../shared/presentation/decorators/public.decorator.js';
import { requireHandoff } from '../../../shared/presentation/handoff-header.js';
import { sendPage } from '../../../shared/presentation/pages/send-page.js';
import {
  CompleteCheckoutUseCase,
  GetCheckoutConfigUseCase,
} from '../application/billing.use-cases.js';
import {
  CheckoutConfigResponseDto,
  CompleteCheckoutRequestDto,
  PlanResponseDto,
  SubscriptionResponseDto,
} from './billing.dto.js';
import { CHECKOUT_HTML, CHECKOUT_JS } from './pages/checkout.page.js';

const CULQI_SCRIPTS = ['https://js.culqi.com'];
const CULQI_ORIGINS = [
  'https://*.culqi.com',
  'https://js.culqi.com',
  'https://checkout.culqi.com',
];

/** The page Culqi's card form runs in, and the two calls it makes. */
@ApiExcludeController()
@Public()
@Controller()
export class CheckoutController {
  constructor(
    private readonly getConfig: GetCheckoutConfigUseCase,
    private readonly complete: CompleteCheckoutUseCase,
    private readonly tokens: HandoffTokens,
  ) {}

  @Get('billing/checkout/config')
  config(
    @Headers('authorization') authorization: string | undefined,
  ): CheckoutConfigResponseDto {
    const claims = requireHandoff(this.tokens, authorization, 'checkout');
    const { publicKey, plan } = this.getConfig.execute(claims);

    return { publicKey, plan: PlanResponseDto.fromDomain(plan) };
  }

  @Post('billing/checkout/complete')
  @HttpCode(HttpStatus.OK)
  async finish(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CompleteCheckoutRequestDto,
  ): Promise<SubscriptionResponseDto> {
    const claims = requireHandoff(this.tokens, authorization, 'checkout');

    return SubscriptionResponseDto.fromView(
      await this.complete.execute(claims, {
        cardToken: body.tokenId,
        email: body.email,
      }),
    );
  }

  @Get('pages/checkout')
  page(@Res() response: Response): void {
    sendPage(response, 'html', CHECKOUT_HTML, {
      scripts: CULQI_SCRIPTS,
      connections: CULQI_ORIGINS,
      frames: CULQI_ORIGINS,
      images: CULQI_ORIGINS,
    });
  }

  @Get('pages/checkout.js')
  script(@Res() response: Response): void {
    sendPage(response, 'js', CHECKOUT_JS);
  }
}
