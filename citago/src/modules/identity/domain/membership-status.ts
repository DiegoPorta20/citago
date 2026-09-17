/**
 * Whether a user still has access to a tenant.
 *
 * Revoking access deactivates the membership; the user account survives,
 * because it may be in use at another business.
 */
export enum MembershipStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

export const MEMBERSHIP_STATUSES = Object.values(MembershipStatus);
