import type { UserRole } from '../../../shared/domain/user-role.js';
import type { Membership } from './membership.entity.js';

export abstract class MembershipRepository {
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Membership | null>;

  abstract findActiveByUserId(userId: string): Promise<Membership[]>;

  abstract listByTenant(tenantId: string): Promise<Membership[]>;

  abstract findByTenantAndUser(
    tenantId: string,
    userId: string,
  ): Promise<Membership | null>;

  abstract countActiveByRole(tenantId: string, role: UserRole): Promise<number>;

  abstract save(membership: Membership): Promise<void>;
}
