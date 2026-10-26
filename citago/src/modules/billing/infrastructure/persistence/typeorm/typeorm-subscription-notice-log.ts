import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { IdGenerator } from '../../../../../shared/application/ports/id-generator.port.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { SubscriptionNoticeLog } from '../../../application/ports/subscription-notice-log.port.js';
import type { Notice } from '../../../domain/notice.js';
import { SubscriptionNoticeOrmEntity } from './entities/subscription-notice.orm-entity.js';

@Injectable()
export class TypeOrmSubscriptionNoticeLog extends SubscriptionNoticeLog {
  constructor(
    private readonly context: TransactionalEntityManager,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  private get repository() {
    return this.context.manager.getRepository(SubscriptionNoticeOrmEntity);
  }

  async claim(
    subscriptionId: string,
    notice: Notice,
    now: Date,
  ): Promise<boolean> {
    try {
      await this.repository.insert({
        id: this.ids.generate(),
        subscriptionId,
        kind: notice.kind,
        ref: notice.ref,
        sentAt: now,
      });

      return true;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY'
      ) {
        return false;
      }

      throw error;
    }
  }

  async release(subscriptionId: string, notice: Notice): Promise<void> {
    await this.repository.delete({
      subscriptionId,
      kind: notice.kind,
      ref: notice.ref,
    });
  }
}
