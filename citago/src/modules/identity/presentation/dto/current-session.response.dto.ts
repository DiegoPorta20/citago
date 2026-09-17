import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../../../shared/domain/user-role.js';
import { BusinessType } from '../../../tenants/domain/business-type.js';

class SessionUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'carlos@barberia.pe' })
  email: string;

  @ApiProperty({ example: 'Carlos Ramírez' })
  name: string;
}

class SessionTenantDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Barbería Los Ángeles' })
  name: string;

  @ApiProperty({ example: 'barberia-los-angeles' })
  slug: string;

  @ApiProperty({ enum: BusinessType })
  businessType: BusinessType;

  @ApiProperty({ example: 'PE' })
  country: string;

  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({
    example: 'America/Lima',
    description: 'Render the agenda in this zone, not in the device zone.',
  })
  timezone: string;
}

export class CurrentSessionResponseDto {
  @ApiProperty({ type: SessionUserDto })
  user: SessionUserDto;

  @ApiProperty({ type: SessionTenantDto })
  tenant: SessionTenantDto;

  @ApiProperty({ enum: UserRole })
  role: UserRole;
}
