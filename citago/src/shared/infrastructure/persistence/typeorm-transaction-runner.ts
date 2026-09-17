import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { TransactionRunner } from '../../application/ports/transaction-runner.port.js';
import { TransactionalEntityManager } from './transactional-entity-manager.js';

@Injectable()
export class TypeOrmTransactionRunner extends TransactionRunner {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TransactionalEntityManager,
  ) {
    super();
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    // Already inside a transaction: join it. Opening a nested one would take a
    // second connection and could deadlock against the outer work.
    if (this.context.isInTransaction) {
      return work();
    }

    return this.dataSource.transaction((manager) =>
      this.context.runWith(manager, work),
    );
  }
}
