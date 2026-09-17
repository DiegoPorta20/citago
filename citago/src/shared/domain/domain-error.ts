/**
 * Kind of failure a domain error represents.
 *
 * The HTTP layer maps categories, not individual error classes, so adding a new
 * domain error never requires touching the presentation layer.
 */
export enum DomainErrorCategory {
  /** The input is structurally valid but semantically wrong. */
  Validation = 'VALIDATION',
  /** The resource does not exist, or belongs to another tenant (never disclose which). */
  NotFound = 'NOT_FOUND',
  /** The operation collides with existing state (duplicates, overlaps). */
  Conflict = 'CONFLICT',
  /** A business rule forbids the operation. */
  BusinessRule = 'BUSINESS_RULE',
  /** The caller is authenticated but not allowed to do this. */
  Forbidden = 'FORBIDDEN',
  /** The caller is not authenticated, or the credentials are invalid. */
  Unauthorized = 'UNAUTHORIZED',
}

/**
 * Base class for every error raised by the domain and application layers.
 *
 * Deliberately free of any framework import: the domain must not know that an
 * HTTP API exists.
 */
export abstract class DomainError extends Error {
  /** Stable, machine-readable identifier, e.g. `APPOINTMENT_OVERLAP`. */
  abstract readonly code: string;

  abstract readonly category: DomainErrorCategory;

  /** Safe, non-sensitive context for the API consumer. */
  readonly details?: Readonly<Record<string, unknown>>;

  protected constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}
