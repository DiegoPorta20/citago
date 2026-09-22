import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';

export class DashboardRangeTooWideError extends DomainError {
  readonly code = 'DASHBOARD_RANGE_TOO_WIDE';
  readonly category = DomainErrorCategory.Validation;

  constructor(maxDays: number) {
    super(`A dashboard period cannot span more than ${maxDays} days.`, {
      maxDays,
    });
  }
}

export class DashboardPeriodInvertedError extends DomainError {
  readonly code = 'DASHBOARD_PERIOD_INVERTED';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    super('A dashboard period cannot end before it starts.');
  }
}
