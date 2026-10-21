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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { ApiErrorDto } from '../../../shared/presentation/dto/api-error.dto.js';
import { GetCurrentSessionUseCase } from '../application/get-current-session/get-current-session.use-case.js';
import { ListMyTenantsUseCase } from '../application/list-my-tenants/list-my-tenants.use-case.js';
import { LoginUseCase } from '../application/login/login.use-case.js';
import { LogoutUseCase } from '../application/logout/logout.use-case.js';
import { RefreshSessionUseCase } from '../application/refresh-session/refresh-session.use-case.js';
import { RegisterBusinessUseCase } from '../application/register-business/register-business.use-case.js';
import type { IssuedSession } from '../application/session-issuer.js';
import { SwitchTenantUseCase } from '../application/switch-tenant/switch-tenant.use-case.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Public } from '../../../shared/presentation/decorators/public.decorator.js';
import { CurrentSessionResponseDto } from './dto/current-session.response.dto.js';
import { LoginRequestDto } from './dto/login.request.dto.js';
import { RefreshTokenRequestDto } from './dto/refresh-token.request.dto.js';
import { RegisterBusinessRequestDto } from './dto/register-business.request.dto.js';
import { SessionResponseDto } from './dto/session.response.dto.js';
import { SwitchTenantRequestDto } from './dto/switch-tenant.request.dto.js';
import { TenantSummaryResponseDto } from './dto/tenant-summary.response.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerBusiness: RegisterBusinessUseCase,
    private readonly login: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logout: LogoutUseCase,
    private readonly getCurrentSession: GetCurrentSessionUseCase,
    private readonly listMyTenants: ListMyTenantsUseCase,
    private readonly switchTenant: SwitchTenantUseCase,
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

  @Get('tenants')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List the businesses the caller can switch into',
    description:
      'Active memberships whose business is available. The current session’s business is flagged with `current: true`.',
  })
  @ApiOkResponse({ type: TenantSummaryResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED', type: ApiErrorDto })
  async tenants(
    @CurrentAuth() auth: AuthContext,
  ): Promise<TenantSummaryResponseDto[]> {
    const views = await this.listMyTenants.execute(auth);

    return views.map((view) => TenantSummaryResponseDto.fromView(view));
  }

  @Post('switch-tenant')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Switch to another of the caller’s businesses',
    description:
      'Issues a new session for the target membership and revokes the session family of the presented refresh token, so the previous business’s session can no longer be refreshed.',
  })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiUnauthorizedResponse({
    description: 'INVALID_REFRESH_TOKEN',
    type: ApiErrorDto,
  })
  @ApiNotFoundResponse({ description: 'NOT_A_MEMBER', type: ApiErrorDto })
  async switch(
    @CurrentAuth() auth: AuthContext,
    @Body() body: SwitchTenantRequestDto,
  ): Promise<SessionResponseDto> {
    const result = await this.switchTenant.execute(auth, {
      tenantId: body.tenantId,
      refreshToken: body.refreshToken,
    });

    return toSessionResponse(result);
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
