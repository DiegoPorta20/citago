import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator.js';
import { ApiErrorDto } from '../../../shared/presentation/dto/api-error.dto.js';
import {
  AddTeamMemberUseCase,
  ChangeTeamMemberAccessUseCase,
  ListTeamMembersUseCase,
} from '../application/team/team.use-cases.js';
import {
  AddTeamMemberRequestDto,
  AddedTeamMemberResponseDto,
  ChangeTeamMemberRoleRequestDto,
  TeamMemberResponseDto,
} from './dto/team.dto.js';

/**
 * Who can enter the business, and as what.
 *
 * The resource is the **membership**, not the person: a user account belongs to
 * the platform, access belongs to one business. Revoking here closes a door
 * without touching an account that may work at another shop.
 *
 * There is **no DELETE**: access is revoked and can be restored, and the
 * history of who did what stays readable (a cancelled appointment still names
 * the person who cancelled it).
 *
 * OWNER and ADMIN reach these endpoints; which rows each may touch depends on
 * the role being granted or withdrawn, so that half lives in the use case
 * (docs/permissions.md).
 */
@ApiTags('team')
@ApiBearerAuth()
@Roles(UserRole.Owner, UserRole.Admin)
@Controller('users')
export class TeamController {
  constructor(
    private readonly listMembers: ListTeamMembersUseCase,
    private readonly addMember: AddTeamMemberUseCase,
    private readonly changeAccess: ChangeTeamMemberAccessUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Everyone with access to the business' })
  @ApiOkResponse({ type: TeamMemberResponseDto, isArray: true })
  async list(
    @CurrentAuth() auth: AuthContext,
  ): Promise<TeamMemberResponseDto[]> {
    const members = await this.listMembers.execute(auth);

    return members.map((view) => TeamMemberResponseDto.fromView(view));
  }

  @Post()
  @ApiOperation({
    summary: 'Give someone access',
    description:
      'Creates the account if the email is new, or attaches the existing one. Without `password`, a temporary one is generated and returned here, once.',
  })
  @ApiCreatedResponse({ type: AddedTeamMemberResponseDto })
  @ApiConflictResponse({
    description: 'USER_ALREADY_IN_TEAM',
    type: ApiErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'ROLE_CHANGE_NOT_ALLOWED',
    type: ApiErrorDto,
  })
  async add(
    @CurrentAuth() auth: AuthContext,
    @Body() body: AddTeamMemberRequestDto,
  ): Promise<AddedTeamMemberResponseDto> {
    return AddedTeamMemberResponseDto.fromResult(
      await this.addMember.execute(auth, body),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change what someone may do' })
  @ApiOkResponse({ type: TeamMemberResponseDto })
  @ApiNotFoundResponse({
    description: 'MEMBERSHIP_NOT_FOUND',
    type: ApiErrorDto,
  })
  @ApiUnprocessableEntityResponse({
    description: 'LAST_OWNER',
    type: ApiErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'CANNOT_CHANGE_OWN_ACCESS, ROLE_CHANGE_NOT_ALLOWED',
    type: ApiErrorDto,
  })
  async changeRole(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeTeamMemberRoleRequestDto,
  ): Promise<TeamMemberResponseDto> {
    return TeamMemberResponseDto.fromView(
      await this.changeAccess.changeRole(auth, id, body.role),
    );
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close the door',
    description:
      'Their sessions stop working on the next request: the role and the membership are checked every time, not trusted from the token (rule ID-6).',
  })
  @ApiOkResponse({ type: TeamMemberResponseDto })
  @ApiUnprocessableEntityResponse({
    description: 'LAST_OWNER',
    type: ApiErrorDto,
  })
  async revoke(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TeamMemberResponseDto> {
    return TeamMemberResponseDto.fromView(
      await this.changeAccess.revoke(auth, id),
    );
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Let them back in, with the role they had' })
  @ApiOkResponse({ type: TeamMemberResponseDto })
  async restore(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TeamMemberResponseDto> {
    return TeamMemberResponseDto.fromView(
      await this.changeAccess.restore(auth, id),
    );
  }
}
