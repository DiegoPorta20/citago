import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import type { UserRole } from '../../../../shared/domain/user-role.js';
import { TenantRepository } from '../../../tenants/domain/tenant.repository.js';
import { MembershipRepository } from '../../domain/membership.repository.js';

export interface MyTenant {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly role: UserRole;
  readonly current: boolean;
}

@Injectable()
export class ListMyTenantsUseCase {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly tenants: TenantRepository,
  ) {}

  async execute(actor: AuthContext): Promise<MyTenant[]> {
    const memberships = await this.memberships.findActiveByUserId(actor.userId);

    const tenants = await Promise.all(
      memberships.map((membership) =>
        this.tenants.findById(membership.tenantId),
      ),
    );

    const result: MyTenant[] = [];

    memberships.forEach((membership, index) => {
      const tenant = tenants[index];

      if (!tenant?.isActive) {
        return;
      }

      result.push({
        tenantId: membership.tenantId,
        tenantName: tenant.name,
        role: membership.role,
        current: membership.tenantId === actor.tenantId,
      });
    });

    return result;
  }
}
