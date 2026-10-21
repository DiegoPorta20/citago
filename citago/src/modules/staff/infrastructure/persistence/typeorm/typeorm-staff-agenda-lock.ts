import { Injectable } from '@nestjs/common';

import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { StaffAgendaLock } from '../../../application/ports/staff-agenda-lock.port.js';

@Injectable()
export class TypeOrmStaffAgendaLock extends StaffAgendaLock {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  async acquire(
    tenantId: string,
    staffMemberIds: readonly string[],
  ): Promise<void> {
    if (!this.context.isInTransaction) {
      throw new Error('StaffAgendaLock.acquire must run inside a transaction.');
    }

    const ordered = [...new Set(staffMemberIds)].sort();

    for (const staffMemberId of ordered) {
      await this.context.manager.query(
        'SELECT `id` FROM `staff_members` WHERE `tenant_id` = ? AND `id` = ? FOR UPDATE',
        [tenantId, staffMemberId],
      );
    }
  }
}
