import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';
import type { SaleStatus } from './sale-status.js';

/** Also raised for another tenant's sale, or one a STAFF user may not see. */
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

/** Rule SA-3: one appointment, at most one sale. */
export class AppointmentAlreadyBilledError extends DomainError {
  readonly code = 'APPOINTMENT_ALREADY_BILLED';
  readonly category = DomainErrorCategory.Conflict;

  /** The existing sale, when the caller is allowed to know which one it is. */
  constructor(saleId?: string) {
    super(
      'That appointment already has a sale.',
      saleId ? { saleId } : undefined,
    );
  }
}

/**
 * Rules SA-3 and AP-9: only a service actually delivered can be charged, so the
 * appointment must be `COMPLETED`. A `NO_SHOW` never becomes revenue.
 */
export class AppointmentNotBillableError extends DomainError {
  readonly code = 'APPOINTMENT_NOT_BILLABLE';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor(status: SaleStatus | string) {
    super('Only a completed appointment can be charged.', { status });
  }
}

/** Rule SA-2: a business never charges a negative amount. */
export class DiscountAboveSubtotalError extends DomainError {
  readonly code = 'DISCOUNT_ABOVE_SUBTOTAL';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super('The discount cannot be larger than the subtotal.');
  }
}

/** Rule SA-4: voiding a sale is an accounting event, not a silent delete. */
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

/** A STAFF user may only record sales for the work they did themselves. */
export class OwnSalesOnlyError extends DomainError {
  readonly code = 'OWN_SALES_ONLY';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('Staff can only record sales for their own work.');
  }
}
