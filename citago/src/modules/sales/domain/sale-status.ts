export enum SaleStatus {
  /** Recorded, not charged yet: the client pays on the way out, or later. */
  Pending = 'PENDING',
  /** Charged. Only these count as revenue (rule SA-5). */
  Paid = 'PAID',
  /** Called off before any money changed hands. */
  Cancelled = 'CANCELLED',
  /** Charged and given back. */
  Refunded = 'REFUNDED',
}

/**
 * The state machine (rule SA-4).
 *
 * A sale is never edited or deleted: a mistake is voided, and which void
 * applies depends on whether money changed hands — `CANCELLED` before payment,
 * `REFUNDED` after it. Both record a reason and their author, so the history
 * explains itself instead of quietly losing a row.
 *
 * Both are terminal. A sale that must be redone is a new sale, and the voided
 * one stays as history next to it.
 */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<SaleStatus, readonly SaleStatus[]>
> = {
  [SaleStatus.Pending]: [SaleStatus.Paid, SaleStatus.Cancelled],
  [SaleStatus.Paid]: [SaleStatus.Refunded],
  [SaleStatus.Cancelled]: [],
  [SaleStatus.Refunded]: [],
};

/** The two ways a sale is voided: each needs a reason and an author. */
export const VOID_STATUSES: ReadonlySet<SaleStatus> = new Set([
  SaleStatus.Cancelled,
  SaleStatus.Refunded,
]);

export function isVoid(status: SaleStatus): boolean {
  return VOID_STATUSES.has(status);
}

/**
 * Whether the sale is money the business actually took (rule SA-5).
 *
 * A refunded sale is not: it was charged and given back, so it must never
 * appear in a revenue figure, even though it was `PAID` for a while.
 */
export function countsAsRevenue(status: SaleStatus): boolean {
  return status === SaleStatus.Paid;
}
