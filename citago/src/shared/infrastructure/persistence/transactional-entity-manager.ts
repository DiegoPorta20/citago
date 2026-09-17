import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

/**
 * Carries the transactional `EntityManager` across the call stack.
 *
 * Node's AsyncLocalStorage keeps it invisible to the application layer: a use
 * case calls `TransactionRunner.run()` and the repositories underneath pick up
 * the right manager without receiving it as a parameter.
 */
const storage = new AsyncLocalStorage<EntityManager>();

/**
 * The manager every TypeORM repository must use.
 *
 * Inside a transaction it returns the transactional manager, so a repository
 * write joins the unit of work. Outside, it returns the default one.
 */
@Injectable()
export class TransactionalEntityManager {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  get manager(): EntityManager {
    return storage.getStore() ?? this.dataSource.manager;
  }

  get isInTransaction(): boolean {
    return storage.getStore() !== undefined;
  }

  /** Used only by the TransactionRunner implementation. */
  runWith<T>(manager: EntityManager, work: () => Promise<T>): Promise<T> {
    return storage.run(manager, work);
  }
}
