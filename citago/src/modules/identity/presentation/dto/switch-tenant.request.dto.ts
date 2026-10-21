import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

export class SwitchTenantRequestDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The business to switch into. Must be one the caller belongs to.',
  })
  @IsUUID()
  tenantId: string;

  @ApiProperty({
    description:
      'The refresh token of the current session. Its whole family is revoked by the switch.',
  })
  @IsString()
  @Length(1, 256)
  refreshToken: string;
}
