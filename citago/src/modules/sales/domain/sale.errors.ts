import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';
import type { SaleStatus } from './sale-status.js';

export class SaleNotFoundError extends DomainError {
  readonly code = 'SALE_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('Sale not found.');
  }
}

export class InvalidSaleTransitionError extends DomainError {
  readonly code = 'INVALID_SALE_TRANSITION';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor(from: SaleStatus, to: SaleStatus) {
    super(`A sale cannot go from ${from} to ${to}.`, { from, to });
  }
}

export class AppointmentAlreadyBilledError extends DomainError {
  readonly code = 'APPOINTMENT_ALREADY_BILLED';
  readonly category = DomainErrorCategory.Conflict;

  constructor(saleId?: string) {
    super(
      'That appointment already has a sale.',
      saleId ? { saleId } : undefined,
    );
  }
}

export class AppointmentNotBillableError extends DomainError {
  readonly code = 'APPOINTMENT_NOT_BILLABLE';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor(status: SaleStatus | string) {
    super('Only a completed appointment can be charged.', { status });
  }
}

export class DiscountAboveSubtotalError extends DomainError {
  readonly code = 'DISCOUNT_ABOVE_SUBTOTAL';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('The discount cannot be larger than the subtotal.');
  }
}

export class VoidReasonRequiredError extends DomainError {
  readonly code = 'VOID_REASON_REQUIRED';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    super('Cancelling or refunding a sale requires a reason.');
  }
}

export class PaymentMethodRequiredError extends DomainError {
  readonly code = 'PAYMENT_METHOD_REQUIRED';
  readonly category = DomainErrorCategory.Validation;

  constructor() {
    super('Charging a sale requires a payment method.');
  }
}

export class InvalidSaleDataError extends DomainError {
  readonly code = 'INVALID_SALE_DATA';
  readonly category = DomainErrorCategory.Validation;

  constructor(field: string, reason: string) {
    super(`Invalid sale ${field}: ${reason}`, { field });
  }
}

export class SalesRangeTooWideError extends DomainError {
  readonly code = 'SALES_RANGE_TOO_WIDE';
  readonly category = DomainErrorCategory.Validation;

  constructor(maxDays: number) {
    super(`A sales query cannot span more than ${maxDays} days.`, { maxDays });
  }
}

export class OwnSalesOnlyError extends DomainError {
  readonly code = 'OWN_SALES_ONLY';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('Staff can only record sales for their own work.');
  }
}
