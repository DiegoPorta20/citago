export enum SaleStatus {
  Pending = 'PENDING',
  Paid = 'PAID',
  Cancelled = 'CANCELLED',
  Refunded = 'REFUNDED',
}

export const ALLOWED_TRANSITIONS: Readonly<
  Record<SaleStatus, readonly SaleStatus[]>
> = {
  [SaleStatus.Pending]: [SaleStatus.Paid, SaleStatus.Cancelled],
  [SaleStatus.Paid]: [SaleStatus.Refunded],
  [SaleStatus.Cancelled]: [],
  [SaleStatus.Refunded]: [],
};

export const VOID_STATUSES: ReadonlySet<SaleStatus> = new Set([
  SaleStatus.Cancelled,
  SaleStatus.Refunded,
]);

export function isVoid(status: SaleStatus): boolean {
  return VOID_STATUSES.has(status);
}

export function countsAsRevenue(status: SaleStatus): boolean {
  return status === SaleStatus.Paid;
}
