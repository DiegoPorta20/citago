import { Global, Module } from '@nestjs/common';

import { Clock } from '../application/ports/clock.port.js';
import { IdGenerator } from '../application/ports/id-generator.port.js';
import { SecretCipher } from '../application/ports/secret-cipher.port.js';
import { TransactionRunner } from '../application/ports/transaction-runner.port.js';
import { AesGcmSecretCipher } from './crypto/aes-gcm-secret-cipher.js';
import { TransactionalEntityManager } from './persistence/transactional-entity-manager.js';
import { TypeOrmTransactionRunner } from './persistence/typeorm-transaction-runner.js';
import { SystemClock } from './system-clock.js';
import { UuidV7IdGenerator } from './uuid-v7-id-generator.js';

@Global()
@Module({
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: UuidV7IdGenerator },
    TransactionalEntityManager,
    { provide: TransactionRunner, useClass: TypeOrmTransactionRunner },
    { provide: SecretCipher, useClass: AesGcmSecretCipher },
  ],
  exports: [
    Clock,
    IdGenerator,
    TransactionRunner,
    TransactionalEntityManager,
    SecretCipher,
  ],
})
export class SharedModule {}
