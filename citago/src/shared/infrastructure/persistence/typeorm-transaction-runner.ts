import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';

import { TransactionRunner } from '../../application/ports/transaction-runner.port.js';
import { TransactionalEntityManager } from './transactional-entity-manager.js';

const ER_LOCK_DEADLOCK = 1213;
const MAX_ATTEMPTS = 3;

@Injectable()
export class TypeOrmTransactionRunner extends TransactionRunner {
  private readonly logger = new Logger(TypeOrmTransactionRunner.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TransactionalEntityManager,
  ) {
    super();
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.context.isInTransaction) {
      return work();
    }

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.dataSource.transaction((manager) =>
          this.context.runWith(manager, work),
        );
      } catch (error) {
        if (!isDeadlock(error) || attempt >= MAX_ATTEMPTS) {
          throw error;
        }

        this.logger.warn(
          `Deadlock detected; retrying transaction (attempt ${attempt + 1}/${MAX_ATTEMPTS})`,
        );
      }
    }
  }
}

function isDeadlock(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { errno?: number }).errno === ER_LOCK_DEADLOCK
  );
}
