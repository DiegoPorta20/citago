import { Logger } from '@nestjs/common';

import {
  EmailSender,
  type EmailMessage,
} from '../../application/ports/email-sender.port.js';

/** Development and tests: nothing leaves the process. */
export class LogEmailSender extends EmailSender {
  private readonly logger = new Logger('Email');
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    this.logger.log(`(not sent) to=${message.to} subject="${message.subject}"`);

    return Promise.resolve();
  }
}
