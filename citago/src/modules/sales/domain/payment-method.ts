/**
 * How the client paid.
 *
 * Data only: nothing in the domain branches on the method. A business that
 * needs per-method rules (fees, settlement dates) gets them when it asks for
 * them, not before.
 */
export enum PaymentMethod {
  Cash = 'CASH',
  Card = 'CARD',
  Transfer = 'TRANSFER',
  Other = 'OTHER',
}

export const PAYMENT_METHODS = Object.values(PaymentMethod);
