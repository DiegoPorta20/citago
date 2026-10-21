import type { UserRole } from '../domain/user-role.js';

export interface AuthContext {
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly role: UserRole;
}
