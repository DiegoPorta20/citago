import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  EmailProvider,
  type EnvironmentVariables,
} from '../../config/environment.js';
import { PageAssetsController } from '../presentation/pages/page-assets.controller.js';
import { Clock } from '../application/ports/clock.port.js';
import { EmailSender } from '../application/ports/email-sender.port.js';
import { HandoffTokens } from '../application/ports/handoff-tokens.port.js';
import { IdGenerator } from '../application/ports/id-generator.port.js';
import { SecretCipher } from '../application/ports/secret-cipher.port.js';
import { TransactionRunner } from '../application/ports/transaction-runner.port.js';
import { AesGcmSecretCipher } from './crypto/aes-gcm-secret-cipher.js';
import { HmacHandoffTokens } from './crypto/hmac-handoff-tokens.js';
import { LogEmailSender } from './email/log-email-sender.js';
import { SesEmailSender } from './email/ses-email-sender.js';
import { TransactionalEntityManager } from './persistence/transactional-entity-manager.js';
import { TypeOrmTransactionRunner } from './persistence/typeorm-transaction-runner.js';
import { SystemClock } from './system-clock.js';
import { UuidV7IdGenerator } from './uuid-v7-id-generator.js';

@Global()
@Module({
  controllers: [PageAssetsController],
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: UuidV7IdGenerator },
    TransactionalEntityManager,
    { provide: TransactionRunner, useClass: TypeOrmTransactionRunner },
    { provide: SecretCipher, useClass: AesGcmSecretCipher },
    { provide: HandoffTokens, useClass: HmacHandoffTokens },
    {
      provide: EmailSender,
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
      ): EmailSender =>
        config.get('EMAIL_PROVIDER', { infer: true }) === EmailProvider.Ses
          ? new SesEmailSender(
              config.get('EMAIL_FROM', { infer: true }),
              config.get('SES_REGION', { infer: true }),
            )
          : new LogEmailSender(),
    },
  ],
  exports: [
    Clock,
    IdGenerator,
    TransactionRunner,
    TransactionalEntityManager,
    SecretCipher,
    HandoffTokens,
    EmailSender,
  ],
})
export class SharedModule {}
