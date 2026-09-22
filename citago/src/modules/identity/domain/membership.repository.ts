import type { UserRole } from '../../../shared/domain/user-role.js';
import type { Membership } from './membership.entity.js';

/**
 * Persistence contract for memberships.
 *
 * Every lookup that targets a single tenant's data takes `tenantId`
 * explicitly. `findActiveByUserId` is the login path: it answers "which
 * businesses can this person enter?", which by definition precedes a tenant
 * context.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class MembershipRepository {
  /** Used by the auth guard on every request; must be scoped to the session's tenant. */
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Membership | null>;

  abstract findActiveByUserId(userId: string): Promise<Membership[]>;

  /** Everyone with access to a business, active or revoked, oldest first. */
  abstract listByTenant(tenantId: string): Promise<Membership[]>;

  abstract findByTenantAndUser(
    tenantId: string,
    userId: string,
  ): Promise<Membership | null>;

  abstract countActiveByRole(tenantId: string, role: UserRole): Promise<number>;

  abstract save(membership: Membership): Promise<void>;
}
