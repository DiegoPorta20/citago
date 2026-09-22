import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator.js';
import { ApiErrorDto } from '../../../shared/presentation/dto/api-error.dto.js';
import { GetBusinessDashboardUseCase } from '../application/get-business-dashboard.use-case.js';
import { GetOwnDashboardUseCase } from '../application/get-own-dashboard.use-case.js';
import {
  BusinessDashboardResponseDto,
  DashboardPeriodQueryDto,
  OwnDashboardResponseDto,
} from './dashboard.dto.js';

/**
 * The numbers.
 *
 * Two endpoints rather than one payload that changes shape with the role: the
 * business dashboard shows money and is OWNER or ADMIN only, while every member
 * can see their own attentions (docs/permissions.md). A reader of the API
 * should be able to tell which is which without reading the guard.
 *
 * Periods are **local dates** of the business, never UTC instants: "today" is
 * the shop's today (rule TZ-2).
 */
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly businessDashboard: GetBusinessDashboardUseCase,
    private readonly ownDashboard: GetOwnDashboardUseCase,
  ) {}

  @Get('summary')
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'How the business did over a period',
    description:
      'Revenue, agenda, new clients, best sellers and per-barber performance. Computed on demand; nothing is precalculated.',
  })
  @ApiOkResponse({ type: BusinessDashboardResponseDto })
  @ApiForbiddenResponse({ description: 'STAFF', type: ApiErrorDto })
  async summary(
    @CurrentAuth() auth: AuthContext,
    @Query() query: DashboardPeriodQueryDto,
  ): Promise<BusinessDashboardResponseDto> {
    return BusinessDashboardResponseDto.fromResult(
      await this.businessDashboard.execute(auth, query),
    );
  }

  @Get('me')
  @ApiOperation({
    summary: 'My own attentions for the period',
    description:
      'Defaults to today. Carries no money: a STAFF user sees what they did, not what the business took.',
  })
  @ApiOkResponse({ type: OwnDashboardResponseDto })
  async me(
    @CurrentAuth() auth: AuthContext,
    @Query() query: DashboardPeriodQueryDto,
  ): Promise<OwnDashboardResponseDto> {
    return OwnDashboardResponseDto.fromResult(
      await this.ownDashboard.execute(auth, query),
    );
  }
}
