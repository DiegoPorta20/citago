export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  /** Plain-text body: always present, it is what mail clients fall back to. */
  readonly text: string;
  readonly html?: string;
}

export class EmailDeliveryError extends Error {
  constructor(
    readonly retryable: boolean,
    cause?: unknown,
  ) {
    super(`Email delivery failed (${retryable ? 'retryable' : 'permanent'}).`, {
      cause,
    });
    this.name = 'EmailDeliveryError';
  }
}

export abstract class EmailSender {
  /** Throws `EmailDeliveryError` when the provider does not accept the message. */
  abstract send(message: EmailMessage): Promise<void>;
}
