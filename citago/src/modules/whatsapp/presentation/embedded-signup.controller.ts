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
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { HandoffTokens } from '../../../shared/application/ports/handoff-tokens.port.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Public } from '../../../shared/presentation/decorators/public.decorator.js';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator.js';
import { requireHandoff } from '../../../shared/presentation/handoff-header.js';
import { sendPage } from '../../../shared/presentation/pages/send-page.js';
import {
  CompleteEmbeddedSignupUseCase,
  GetEmbeddedSignupConfigUseCase,
  StartEmbeddedSignupUseCase,
} from '../application/embedded-signup.use-cases.js';
import {
  CompleteEmbeddedSignupRequestDto,
  EmbeddedSignupConfigResponseDto,
  EmbeddedSignupSessionResponseDto,
} from './embedded-signup.dto.js';
import {
  WHATSAPP_SIGNUP_HTML,
  WHATSAPP_SIGNUP_JS,
} from './pages/whatsapp-signup.page.js';
import { WhatsAppChannelResponseDto } from './whatsapp-channel.dto.js';

const FACEBOOK = ['https://connect.facebook.net'];
const FACEBOOK_ORIGINS = [
  'https://www.facebook.com',
  'https://web.facebook.com',
  'https://staticxx.facebook.com',
];

@Controller()
export class EmbeddedSignupController {
  constructor(
    private readonly start: StartEmbeddedSignupUseCase,
    private readonly getConfig: GetEmbeddedSignupConfigUseCase,
    private readonly complete: CompleteEmbeddedSignupUseCase,
    private readonly tokens: HandoffTokens,
  ) {}

  // ── Called by the app, with the user's session ───────────────────────────

  @Post('whatsapp/embedded-signup/session')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiTags('whatsapp')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Link to connect WhatsApp automatically (Meta Embedded Signup)',
    description:
      'Returns a URL for the browser. 503 WHATSAPP_SIGNUP_NOT_CONFIGURED until the Meta app is set up.',
  })
  @ApiOkResponse({ type: EmbeddedSignupSessionResponseDto })
  session(@CurrentAuth() auth: AuthContext): EmbeddedSignupSessionResponseDto {
    return this.start.execute(auth);
  }

  // ── Called by the hosted page, with the short-lived handoff token ────────

  @Public()
  @Get('whatsapp/embedded-signup/config')
  @ApiExcludeEndpoint()
  config(
    @Headers('authorization') authorization: string | undefined,
  ): EmbeddedSignupConfigResponseDto {
    requireHandoff(this.tokens, authorization, 'whatsapp-signup');

    return this.getConfig.execute();
  }

  @Public()
  @Post('whatsapp/embedded-signup/complete')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async finish(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CompleteEmbeddedSignupRequestDto,
  ): Promise<WhatsAppChannelResponseDto> {
    const claims = requireHandoff(
      this.tokens,
      authorization,
      'whatsapp-signup',
    );

    return WhatsAppChannelResponseDto.fromDomain(
      await this.complete.execute(claims.tenantId, {
        code: body.code,
        phoneNumberId: body.phoneNumberId,
        wabaId: body.wabaId,
      }),
    );
  }

  // ── The page itself ──────────────────────────────────────────────────────

  @Public()
  @Get('pages/whatsapp-signup')
  @ApiExcludeEndpoint()
  page(@Res() response: Response): void {
    sendPage(response, 'html', WHATSAPP_SIGNUP_HTML, {
      scripts: FACEBOOK,
      connections: FACEBOOK_ORIGINS,
      frames: FACEBOOK_ORIGINS,
      images: FACEBOOK_ORIGINS,
    });
  }

  @Public()
  @Get('pages/whatsapp-signup.js')
  @ApiExcludeEndpoint()
  script(@Res() response: Response): void {
    sendPage(response, 'js', WHATSAPP_SIGNUP_JS);
  }
}
