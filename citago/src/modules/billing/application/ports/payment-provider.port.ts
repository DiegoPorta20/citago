import type { PlanCode } from '../../domain/plan.js';

/** What the gateway tells us about a recurring charge. */
export interface GatewaySubscription {
  readonly id: string;
  readonly customerId: string | null;
  /** When the next charge is due, i.e. the end of the period already paid. */
  readonly periodEnd: Date | null;
  readonly canceled: boolean;
}

export interface CheckoutCustomer {
  /** The gateway's id for the payer, when we already created one. */
  readonly existingCustomerId: string | null;
  readonly email: string;
  readonly businessName: string;
  readonly country: string;
  readonly phone: string | null;
}

export type PaymentFailure =
  /** The card was refused. `userMessage` is safe to show. */
  | 'DECLINED'
  /** The card token was invalid, expired or already used. */
  | 'REJECTED'
  /** Our credentials or plan ids are wrong: an operator problem, not the customer's. */
  | 'MISCONFIGURED'
  | 'UNAVAILABLE';

export class PaymentGatewayError extends Error {
  constructor(
    readonly failure: PaymentFailure,
    readonly userMessage: string | null = null,
  ) {
    super(`Payment gateway call failed: ${failure}`);
    this.name = 'PaymentGatewayError';
  }
}

export abstract class PaymentProvider {
  /** Charges the card for the plan now and every period after. */
  abstract subscribe(input: {
    readonly planCode: PlanCode;
    readonly tenantId: string;
    readonly cardToken: string;
    readonly customer: CheckoutCustomer;
  }): Promise<GatewaySubscription>;

  /** `null` when the gateway no longer has it (it was cancelled or removed). */
  abstract fetchSubscription(id: string): Promise<GatewaySubscription | null>;

  /** Stops future charges. Cancelling something already gone is not an error. */
  abstract cancelSubscription(id: string): Promise<void>;
}
