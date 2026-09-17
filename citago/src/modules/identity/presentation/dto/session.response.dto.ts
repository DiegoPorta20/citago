import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../../../shared/domain/user-role.js';

/**
 * What a sign-up, sign-in or refresh returns.
 *
 * The response never carries the password hash, the token hash or any internal
 * identifier beyond the ones the client needs.
 */
export class SessionResponseDto {
  @ApiProperty({ description: 'Bearer token for the Authorization header.' })
  accessToken: string;

  @ApiProperty({
    example: 900,
    description: 'Access token lifetime in seconds.',
  })
  expiresIn: number;

  @ApiProperty({
    description:
      'Opaque token used to obtain a new pair. Rotates on every use.',
  })
  refreshToken: string;

  @ApiProperty({ format: 'uuid' })
  tenantId: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;
}
