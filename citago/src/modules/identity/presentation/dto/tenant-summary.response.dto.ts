import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../../../shared/domain/user-role.js';
import type { MyTenant } from '../../application/list-my-tenants/list-my-tenants.use-case.js';

export class TenantSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  tenantId: string;

  @ApiProperty({ example: 'Barbería Demo' })
  tenantName: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({
    description: 'True for the business the current access token is bound to.',
  })
  current: boolean;

  static fromView(view: MyTenant): TenantSummaryResponseDto {
    return {
      tenantId: view.tenantId,
      tenantName: view.tenantName,
      role: view.role,
      current: view.current,
    };
  }
}
