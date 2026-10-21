import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

const storage = new AsyncLocalStorage<EntityManager>();

@Injectable()
export class TransactionalEntityManager {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  get manager(): EntityManager {
    return storage.getStore() ?? this.dataSource.manager;
  }

  get isInTransaction(): boolean {
    return storage.getStore() !== undefined;
  }

  runWith<T>(manager: EntityManager, work: () => Promise<T>): Promise<T> {
    return storage.run(manager, work);
  }
}
