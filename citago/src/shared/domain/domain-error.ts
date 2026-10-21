export enum DomainErrorCategory {
  Validation = 'VALIDATION',
  NotFound = 'NOT_FOUND',
  Conflict = 'CONFLICT',
  BusinessRule = 'BUSINESS_RULE',
  Forbidden = 'FORBIDDEN',
  Unauthorized = 'UNAUTHORIZED',
  ExternalService = 'EXTERNAL_SERVICE',
}

export abstract class DomainError extends Error {
  abstract readonly code: string;

  abstract readonly category: DomainErrorCategory;

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
