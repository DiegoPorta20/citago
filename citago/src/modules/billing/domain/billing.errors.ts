import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';

export class UnknownPlanError extends DomainError {
  readonly code = 'UNKNOWN_PLAN';
  readonly category = DomainErrorCategory.Validation;

  constructor(code: string) {
    super(`There is no plan "${code}".`, { planCode: code });
  }
}

export class SubscriptionNotFoundError extends DomainError {
  readonly code = 'SUBSCRIPTION_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('This business has no subscription.');
  }
}

export class SubscriptionExpiredError extends DomainError {
  readonly code = 'SUBSCRIPTION_EXPIRED';
  readonly category = DomainErrorCategory.PaymentRequired;

  constructor() {
    super(
      'The free trial has ended. Choose a plan to keep making changes; your data is safe and still readable.',
    );
  }
}
