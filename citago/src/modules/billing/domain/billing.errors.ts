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
      'The subscription is not active. Choose and pay for a plan to keep making changes; your data is safe and still readable.',
    );
  }
}

export class StaffLimitReachedError extends DomainError {
  readonly code = 'STAFF_LIMIT_REACHED';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor(planName: string, planCode: string, limit: number) {
    super(
      `The ${planName} plan allows up to ${limit} active professionals. Choose a bigger plan or deactivate one.`,
      { planCode, limit },
    );
  }
}

export class PaymentsNotConfiguredError extends DomainError {
  readonly code = 'PAYMENTS_NOT_CONFIGURED';
  readonly category = DomainErrorCategory.Unavailable;

  constructor() {
    super('Online payments are not enabled on this server yet.');
  }
}

export class PaymentDeclinedError extends DomainError {
  readonly code = 'PAYMENT_DECLINED';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor(reason: string | null) {
    super(
      reason ??
        'The card was not accepted. Try another card or contact your bank.',
    );
  }
}

export class PaymentUnavailableError extends DomainError {
  readonly code = 'PAYMENT_UNAVAILABLE';
  readonly category = DomainErrorCategory.ExternalService;

  constructor() {
    super('The payment service could not be reached. Try again in a moment.');
  }
}

export class AlreadySubscribedError extends DomainError {
  readonly code = 'ALREADY_SUBSCRIBED';
  readonly category = DomainErrorCategory.Conflict;

  constructor() {
    super('This business already pays for that plan.');
  }
}

export class PlanChangeRequiresPaymentError extends DomainError {
  readonly code = 'PLAN_CHANGE_REQUIRES_PAYMENT';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super(
      'This business is already paying. To change plan, pay for the new one: it replaces the current one.',
    );
  }
}

export class NotPayingError extends DomainError {
  readonly code = 'NOT_PAYING';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('This business has no paid subscription to cancel.');
  }
}
