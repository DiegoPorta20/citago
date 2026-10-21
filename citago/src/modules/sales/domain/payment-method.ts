export enum PaymentMethod {
  Cash = 'CASH',
  Card = 'CARD',
  Transfer = 'TRANSFER',
  Other = 'OTHER',
}

export const PAYMENT_METHODS = Object.values(PaymentMethod);
