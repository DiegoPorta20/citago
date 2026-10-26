import {
  SendEmailCommand,
  SESv2Client,
  type SESv2ClientConfig,
} from '@aws-sdk/client-sesv2';

import {
  EmailDeliveryError,
  EmailSender,
  type EmailMessage,
} from '../../application/ports/email-sender.port.js';

/** SES error names that a retry cannot fix. */
const PERMANENT_ERRORS = new Set([
  'MessageRejected',
  'MailFromDomainNotVerifiedException',
  'AccountSuspendedException',
  'NotFoundException',
  'BadRequestException',
]);

interface SdkError {
  readonly name?: string;
  readonly $retryable?: unknown;
  readonly $metadata?: { readonly httpStatusCode?: number };
}

/**
 * Amazon SES v2. Credentials come from the default AWS chain (instance/task
 * role in production, profile or env vars locally): there is no key in this
 * app's configuration to leak.
 */
export class SesEmailSender extends EmailSender {
  private readonly client: SESv2Client;

  constructor(
    private readonly from: string,
    region: string,
    clientConfig: Partial<SESv2ClientConfig> = {},
  ) {
    super();

    if (from.trim().length === 0) {
      throw new Error('EMAIL_FROM is required when EMAIL_PROVIDER=ses.');
    }

    this.client = new SESv2Client({ region, ...clientConfig });
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: this.from,
          Destination: { ToAddresses: [message.to] },
          Content: {
            Simple: {
              Subject: { Data: message.subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: message.text, Charset: 'UTF-8' },
                ...(message.html
                  ? { Html: { Data: message.html, Charset: 'UTF-8' } }
                  : {}),
              },
            },
          },
        }),
      );
    } catch (error) {
      throw new EmailDeliveryError(isRetryable(error as SdkError), error);
    }
  }
}

function isRetryable(error: SdkError): boolean {
  if (error.name && PERMANENT_ERRORS.has(error.name)) {
    return false;
  }

  const status = error.$metadata?.httpStatusCode;

  return (
    error.$retryable !== undefined || status === undefined || status >= 500
  );
}
