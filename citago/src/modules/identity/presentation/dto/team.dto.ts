import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

import { USER_ROLES, UserRole } from '../../../../shared/domain/user-role.js';
import { MembershipStatus } from '../../domain/membership-status.js';
import type {
  AddedTeamMember,
  TeamMemberView,
} from '../../application/team/team.use-cases.js';
import { MIN_PASSWORD_LENGTH } from './register-business.request.dto.js';

const MAX_PASSWORD_LENGTH = 128;

export class AddTeamMemberRequestDto {
  @ApiProperty({ example: 'Luis Torres', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'luis@barberia.pe' })
  @IsEmail()
  @MaxLength(160)
  email: string;

  @ApiProperty({
    enum: USER_ROLES,
    description: 'Only an OWNER can grant ADMIN or OWNER.',
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    minLength: MIN_PASSWORD_LENGTH,
    description:
      'Optional. Left out, CitaGo generates one and returns it once in this response.',
  })
  @IsOptional()
  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  password?: string;
}

export class ChangeTeamMemberRoleRequestDto {
  @ApiProperty({ enum: USER_ROLES })
  @IsEnum(UserRole)
  role: UserRole;
}

export class TeamMemberResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The membership: the access itself, not the person.',
  })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'Luis Torres' })
  name: string;

  @ApiProperty({ example: 'luis@barberia.pe' })
  email: string;

  @ApiProperty({ enum: USER_ROLES })
  role: UserRole;

  @ApiProperty({ enum: MembershipStatus })
  status: MembershipStatus;

  @ApiProperty()
  createdAt: string;

  static fromView(view: TeamMemberView): TeamMemberResponseDto {
    const membership = view.membership.toSnapshot();

    return {
      id: membership.id,
      userId: membership.userId,
      name: view.user.name,
      email: view.user.email.value,
      role: membership.role,
      status: membership.status,
      createdAt: membership.createdAt.toISOString(),
    };
  }
}

export class AddedTeamMemberResponseDto extends TeamMemberResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Shown **once**. Null when the password was chosen by the inviter, or when the person already had an account. It is never stored in plain text and cannot be read again.',
  })
  temporaryPassword: string | null;

  static fromResult(result: AddedTeamMember): AddedTeamMemberResponseDto {
    return {
      ...TeamMemberResponseDto.fromView(result.member),
      temporaryPassword: result.temporaryPassword,
    };
  }
}
