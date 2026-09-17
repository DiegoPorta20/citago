/**
 * A service is never deleted: it is deactivated.
 *
 * Deleting one would either destroy the history of the appointments that used
 * it or leave them dangling (rule CA-3).
 */
export enum ServiceStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

export const SERVICE_STATUSES = Object.values(ServiceStatus);
