/** A tenant is never deleted: it is suspended. */
export enum TenantStatus {
  Active = 'ACTIVE',
  Suspended = 'SUSPENDED',
}

export const TENANT_STATUSES = Object.values(TenantStatus);
