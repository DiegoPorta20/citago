import { DomainError, DomainErrorCategory } from './domain-error.js';

export class InvalidHandoffTokenError extends DomainError {
  readonly code = 'INVALID_HANDOFF_TOKEN';
  readonly category = DomainErrorCategory.Unauthorized;

  constructor() {
    super('This link is invalid or has expired. Start again from the app.');
  }
}
