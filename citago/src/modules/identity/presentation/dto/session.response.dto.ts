import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../../../shared/domain/user-role.js';

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
