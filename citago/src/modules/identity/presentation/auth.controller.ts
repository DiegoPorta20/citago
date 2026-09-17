import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { ApiErrorDto } from '../../../shared/presentation/dto/api-error.dto.js';
import { GetCurrentSessionUseCase } from '../application/get-current-session/get-current-session.use-case.js';
import { LoginUseCase } from '../application/login/login.use-case.js';
import { LogoutUseCase } from '../application/logout/logout.use-case.js';
import { RefreshSessionUseCase } from '../application/refresh-session/refresh-session.use-case.js';
import { RegisterBusinessUseCase } from '../application/register-business/register-business.use-case.js';
import type { IssuedSession } from '../application/session-issuer.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Public } from '../../../shared/presentation/decorators/public.decorator.js';
import { CurrentSessionResponseDto } from './dto/current-session.response.dto.js';
import { LoginRequestDto } from './dto/login.request.dto.js';
import { RefreshTokenRequestDto } from './dto/refresh-token.request.dto.js';
import { RegisterBusinessRequestDto } from './dto/register-business.request.dto.js';
import { SessionResponseDto } from './dto/session.response.dto.js';

/**
 * Authentication endpoints.
 *
 * The controller stays thin on purpose: validate, call one use case, map the
 * result. No business decision is taken here.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerBusiness: RegisterBusinessUseCase,
    private readonly login: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logout: LogoutUseCase,
    private readonly getCurrentSession: GetCurrentSessionUseCase,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a business and its first user',
    description:
      'Creates the tenant, the account and its OWNER membership atomically, and returns a session.',
  })
  @ApiCreatedResponse({ type: SessionResponseDto })
  @ApiConflictResponse({
    description: 'EMAIL_ALREADY_REGISTERED',
    type: ApiErrorDto,
  })
  async register(
    @Body() body: RegisterBusinessRequestDto,
  ): Promise<SessionResponseDto> {
    const result = await this.registerBusiness.execute({
      businessName: body.businessName,
      businessType: body.businessType,
      country: body.country,
      currency: body.currency,
      timezone: body.timezone,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      password: body.password,
    });

    return toSessionResponse(result);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiUnauthorizedResponse({
    description: 'INVALID_CREDENTIALS',
    type: ApiErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'NO_ACTIVE_MEMBERSHIP',
    type: ApiErrorDto,
  })
  async signIn(@Body() body: LoginRequestDto): Promise<SessionResponseDto> {
    const result = await this.login.execute({
      email: body.email,
      password: body.password,
    });

    return toSessionResponse(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new pair',
    description:
      'The presented token is rotated. Presenting an already rotated token revokes the whole session family.',
  })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiUnauthorizedResponse({
    description: 'INVALID_REFRESH_TOKEN',
    type: ApiErrorDto,
  })
  async refresh(
    @Body() body: RefreshTokenRequestDto,
  ): Promise<SessionResponseDto> {
    const result = await this.refreshSession.execute({
      refreshToken: body.refreshToken,
    });

    return toSessionResponse(result);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Sign out',
    description:
      'Revokes the session family. Succeeds even for an unknown token, so it cannot be used to probe for valid ones.',
  })
  @ApiNoContentResponse()
  async signOut(@Body() body: RefreshTokenRequestDto): Promise<void> {
    await this.logout.execute({ refreshToken: body.refreshToken });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Describe the current session' })
  @ApiOkResponse({ type: CurrentSessionResponseDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED', type: ApiErrorDto })
  async me(
    @CurrentAuth() auth: AuthContext,
  ): Promise<CurrentSessionResponseDto> {
    return this.getCurrentSession.execute(auth);
  }
}

interface SessionCarrier {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: SessionResponseDto['role'];
  readonly session: IssuedSession;
}

function toSessionResponse(result: SessionCarrier): SessionResponseDto {
  return {
    accessToken: result.session.accessToken,
    expiresIn: result.session.accessTokenExpiresInSeconds,
    refreshToken: result.session.refreshToken,
    tenantId: result.tenantId,
    userId: result.userId,
    role: result.role,
  };
}
