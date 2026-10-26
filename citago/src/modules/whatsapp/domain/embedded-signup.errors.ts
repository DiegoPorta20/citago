import {
  DomainError,
  DomainErrorCategory,
} from '../../../shared/domain/domain-error.js';

export class WhatsAppSignupRejectedError extends DomainError {
  readonly code = 'WHATSAPP_SIGNUP_REJECTED';
  readonly category = DomainErrorCategory.BusinessRule;

  constructor() {
    super(
      'Meta did not accept the WhatsApp sign-up (the code may have expired). Start it again.',
    );
  }
}

export class WhatsAppSignupNotConfiguredError extends DomainError {
  readonly code = 'WHATSAPP_SIGNUP_NOT_CONFIGURED';
  readonly category = DomainErrorCategory.Unavailable;

  constructor() {
    super(
      'Automatic WhatsApp connection is not enabled on this server yet. Connect the number manually.',
    );
  }
}
