import type { UserRole } from '../domain/user-role.js';

/**
 * Who is making the request, resolved from the authenticated session.
 *
 * Every use case that touches tenant-owned data receives this **explicitly**.
 * The tenant is never read from a body, query string or header: it comes from
 * the verified session and nowhere else.
 *
 * `role` is loaded from the membership on every request, not taken from the
 * token, so revoking access or changing a role takes effect immediately.
 */
export interface AuthContext {
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly role: UserRole;
}
