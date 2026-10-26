import type { PlanCode } from '../../domain/plan.js';

/** Configuration the checkout needs; nothing here is secret except by omission. */
export abstract class PaymentSettings {
  /** The public key the browser uses to tokenize the card. */
  abstract readonly publicKey: string;

  abstract readonly pageBaseUrl: string;

  /** Whether keys and the gateway's plan for `planCode` are all set. */
  abstract isEnabledFor(planCode: PlanCode): boolean;
}
