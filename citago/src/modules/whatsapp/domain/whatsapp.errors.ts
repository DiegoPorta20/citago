import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';

export class InvalidWhatsAppChannelDataError extends DomainError {
  readonly code = 'INVALID_WHATSAPP_CHANNEL_DATA';
  readonly category = DomainErrorCategory.Validation;

  constructor(field: string, reason: string) {
    super(`Invalid WhatsApp channel ${field}: ${reason}`, { field });
  }
}

/** Meta refused the token or the phone number id when connecting. */
export class WhatsAppCredentialsRejectedError extends DomainError {
  readonly code = 'WHATSAPP_CREDENTIALS_REJECTED';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super(
      'Meta rejected the access token or the phone number id. Check both and try again.',
    );
  }
}

export class WhatsAppUnavailableError extends DomainError {
  readonly code = 'WHATSAPP_UNAVAILABLE';
  readonly category = DomainErrorCategory.ExternalService;

  constructor() {
    super('WhatsApp could not be reached. Try again in a moment.');
  }
}

/**
 * The number is already connected to another business. Deliberately vague:
 * it must not reveal which one.
 */
export class WhatsAppNumberInUseError extends DomainError {
  readonly code = 'WHATSAPP_NUMBER_IN_USE';
  readonly category = DomainErrorCategory.Conflict;

  constructor() {
    super('This WhatsApp number is already connected to another business.');
  }
}

/** A webhook without a valid Meta signature. */
export class InvalidWebhookSignatureError extends DomainError {
  readonly code = 'INVALID_SIGNATURE';
  readonly category = DomainErrorCategory.Unauthorized;

  constructor() {
    super('Invalid signature.');
  }
}

export class WebhookVerificationFailedError extends DomainError {
  readonly code = 'WEBHOOK_VERIFICATION_FAILED';
  readonly category = DomainErrorCategory.Forbidden;

  constructor() {
    super('Webhook verification failed.');
  }
}
