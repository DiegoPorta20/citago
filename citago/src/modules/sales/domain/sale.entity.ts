import { Money } from '../../../shared/domain/money.js';
import type { PaymentMethod } from './payment-method.js';
import { SaleLine, type SaleLineSnapshot } from './sale-line.js';
import {
  DiscountAboveSubtotalError,
  InvalidSaleDataError,
  InvalidSaleTransitionError,
  PaymentMethodRequiredError,
  VoidReasonRequiredError,
} from './sale.errors.js';
import { ALLOWED_TRANSITIONS, isVoid, SaleStatus } from './sale-status.js';

const MAX_LINES = 50;
const MAX_REASON_LENGTH = 255;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export interface SaleSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly appointmentId: string | null;
  readonly clientId: string | null;
  readonly staffMemberId: string | null;
  readonly status: SaleStatus;
  /** ISO-4217 code, frozen when the sale was recorded (rule SA-6). */
  readonly currency: string;
  readonly subtotal: string;
  readonly discount: string;
  readonly total: string;
  readonly paymentMethod: PaymentMethod | null;
  readonly soldAt: Date;
  readonly paidAt: Date | null;
  readonly voidedAt: Date | null;
  readonly voidReason: string | null;
  readonly voidedByUserId: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lines: readonly SaleLineSnapshot[];
}

export interface RegisterSaleInput {
  readonly id: string;
  readonly tenantId: string;
  readonly appointmentId?: string | null;
  readonly clientId?: string | null;
  readonly staffMemberId?: string | null;
  readonly currency: string;
  readonly lines: readonly SaleLine[];
  readonly discount?: Money;
  /** Given when the client pays on the spot; absent leaves the sale PENDING. */
  readonly paymentMethod?: PaymentMethod | null;
  readonly createdByUserId: string | null;
}

export interface SaleTransitionContext {
  readonly actorUserId: string | null;
  readonly reason?: string | null;
  /** Required when charging a pending sale. */
  readonly paymentMethod?: PaymentMethod | null;
}

/**
 * Money the business took, or is owed, for work already done.
 *
 * The amounts are **derived, never assigned**: the subtotal is the sum of the
 * lines and the total is `subtotal - discount` (rule SA-2), so a client cannot
 * send a total that disagrees with what was charged. They are stored anyway, as
 * a snapshot: a report must not have to re-derive history.
 *
 * The lines are fixed at registration. Nothing about a sale is editable
 * afterwards (rule SA-4) — only its status moves, and only towards paid,
 * cancelled or refunded.
 */
export class Sale {
  private constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly appointmentId: string | null,
    readonly clientId: string | null,
    readonly staffMemberId: string | null,
    private _status: SaleStatus,
    readonly currency: string,
    readonly lines: readonly SaleLine[],
    readonly discount: Money,
    private _paymentMethod: PaymentMethod | null,
    readonly soldAt: Date,
    private _paidAt: Date | null,
    private _voidedAt: Date | null,
    private _voidReason: string | null,
    private _voidedByUserId: string | null,
    readonly createdByUserId: string | null,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static register(input: RegisterSaleInput, now: Date): Sale {
    const lines = assertLines(input.lines);
    const discount = input.discount ?? Money.zero();
    const subtotal = subtotalOf(lines);

    if (discount.isGreaterThan(subtotal)) {
      throw new DiscountAboveSubtotalError();
    }

    const paymentMethod = input.paymentMethod ?? null;

    return new Sale(
      input.id,
      input.tenantId,
      input.appointmentId ?? null,
      input.clientId ?? null,
      input.staffMemberId ?? null,
      paymentMethod ? SaleStatus.Paid : SaleStatus.Pending,
      assertCurrency(input.currency),
      lines,
      discount,
      paymentMethod,
      now,
      paymentMethod ? now : null,
      null,
      null,
      null,
      input.createdByUserId,
      now,
      now,
    );
  }

  static restore(snapshot: SaleSnapshot): Sale {
    return new Sale(
      snapshot.id,
      snapshot.tenantId,
      snapshot.appointmentId,
      snapshot.clientId,
      snapshot.staffMemberId,
      snapshot.status,
      snapshot.currency,
      snapshot.lines.map((line) => SaleLine.restore(line)),
      Money.fromDecimalString(snapshot.discount),
      snapshot.paymentMethod,
      snapshot.soldAt,
      snapshot.paidAt,
      snapshot.voidedAt,
      snapshot.voidReason,
      snapshot.voidedByUserId,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get status(): SaleStatus {
    return this._status;
  }

  get paymentMethod(): PaymentMethod | null {
    return this._paymentMethod;
  }

  get paidAt(): Date | null {
    return this._paidAt;
  }

  get voidedAt(): Date | null {
    return this._voidedAt;
  }

  get voidReason(): string | null {
    return this._voidReason;
  }

  get voidedByUserId(): string | null {
    return this._voidedByUserId;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get subtotal(): Money {
    return subtotalOf(this.lines);
  }

  /** What the client owes or paid: subtotal minus discount (rule SA-2). */
  get total(): Money {
    return this.subtotal.subtract(this.discount);
  }

  canTransitionTo(target: SaleStatus): boolean {
    return ALLOWED_TRANSITIONS[this._status].includes(target);
  }

  /**
   * Charges, cancels or refunds the sale.
   *
   * Voiding always asks for a reason and remembers who decided it: a sale that
   * disappears from the day takings must be able to explain itself.
   */
  transitionTo(
    target: SaleStatus,
    context: SaleTransitionContext,
    now: Date,
  ): void {
    if (!this.canTransitionTo(target)) {
      throw new InvalidSaleTransitionError(this._status, target);
    }

    if (target === SaleStatus.Paid) {
      const paymentMethod = context.paymentMethod ?? this._paymentMethod;

      if (!paymentMethod) {
        throw new PaymentMethodRequiredError();
      }

      this._paymentMethod = paymentMethod;
      this._paidAt = now;
    }

    if (isVoid(target)) {
      const reason = assertReason(context.reason ?? null);

      if (!reason) {
        throw new VoidReasonRequiredError();
      }

      this._voidedAt = now;
      this._voidReason = reason;
      this._voidedByUserId = context.actorUserId;
    }

    this._status = target;
    this._updatedAt = now;
  }

  toSnapshot(): SaleSnapshot {
    return {
      id: this.id,
      tenantId: this.tenantId,
      appointmentId: this.appointmentId,
      clientId: this.clientId,
      staffMemberId: this.staffMemberId,
      status: this._status,
      currency: this.currency,
      subtotal: this.subtotal.toDecimalString(),
      discount: this.discount.toDecimalString(),
      total: this.total.toDecimalString(),
      paymentMethod: this._paymentMethod,
      soldAt: this.soldAt,
      paidAt: this._paidAt,
      voidedAt: this._voidedAt,
      voidReason: this._voidReason,
      voidedByUserId: this._voidedByUserId,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      lines: this.lines.map((line) => line.toSnapshot()),
    };
  }
}

function subtotalOf(lines: readonly SaleLine[]): Money {
  return lines.reduce((sum, line) => sum.add(line.total), Money.zero());
}

function assertLines(lines: readonly SaleLine[]): readonly SaleLine[] {
  if (lines.length === 0) {
    throw new InvalidSaleDataError('lines', 'a sale needs at least one line');
  }
  if (lines.length > MAX_LINES) {
    throw new InvalidSaleDataError(
      'lines',
      `a sale cannot have more than ${MAX_LINES} lines`,
    );
  }

  return [...lines];
}

function assertCurrency(value: string): string {
  if (!CURRENCY_PATTERN.test(value)) {
    throw new InvalidSaleDataError(
      'currency',
      'it must be a 3-letter ISO-4217 code',
    );
  }

  return value;
}

function assertReason(value: string | null): string | null {
  const reason = value?.trim() ?? '';

  if (reason.length === 0) {
    return null;
  }
  if (reason.length > MAX_REASON_LENGTH) {
    throw new InvalidSaleDataError(
      'reason',
      `it cannot exceed ${MAX_REASON_LENGTH} characters`,
    );
  }

  return reason;
}
