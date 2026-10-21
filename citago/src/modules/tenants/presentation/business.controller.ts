import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
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
import {
  GetBusinessUseCase,
  ReplaceBusinessHoursUseCase,
  UpdateBusinessUseCase,
} from '../application/business.use-cases.js';
import {
  BusinessResponseDto,
  ReplaceBusinessHoursRequestDto,
  UpdateBusinessRequestDto,
} from './business.dto.js';

@ApiTags('business')
@ApiBearerAuth()
@Controller('business')
export class BusinessController {
  constructor(
    private readonly getBusiness: GetBusinessUseCase,
    private readonly updateBusiness: UpdateBusinessUseCase,
    private readonly replaceHours: ReplaceBusinessHoursUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'The business settings and its opening hours' })
  @ApiOkResponse({ type: BusinessResponseDto })
  async read(@CurrentAuth() auth: AuthContext): Promise<BusinessResponseDto> {
    return BusinessResponseDto.fromView(await this.getBusiness.execute(auth));
  }

  @Patch()
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Edit the settings',
    description:
      'The currency cannot be changed: the catalogue stores bare amounts that are read in it.',
  })
  @ApiOkResponse({ type: BusinessResponseDto })
  @ApiForbiddenResponse({ description: 'STAFF', type: ApiErrorDto })
  async update(
    @CurrentAuth() auth: AuthContext,
    @Body() body: UpdateBusinessRequestDto,
  ): Promise<BusinessResponseDto> {
    return BusinessResponseDto.fromView(
      await this.updateBusiness.execute(auth, body),
    );
  }

  @Put('hours')
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Replace the opening hours',
    description:
      'The whole week at once. Informative: a booking is validated against the staff schedule, not against these hours.',
  })
  @ApiOkResponse({ type: BusinessResponseDto })
  async setHours(
    @CurrentAuth() auth: AuthContext,
    @Body() body: ReplaceBusinessHoursRequestDto,
  ): Promise<BusinessResponseDto> {
    return BusinessResponseDto.fromView(
      await this.replaceHours.execute(auth, body.ranges),
    );
  }
}
