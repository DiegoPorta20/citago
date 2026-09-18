import { Injectable } from '@nestjs/common';

import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { StaffAgendaLock } from '../../../application/ports/staff-agenda-lock.port.js';

/**
 * Pessimistic lock on the staff member's row: `SELECT … FOR UPDATE`.
 *
 * Chosen over alternatives (see Parte 3 §15): locking a range of appointments
 * depends on index gap locks and deadlocks easily; a unique "slot" table forces
 * a fixed granularity; optimistic versions retry in a loop at peak hours. One
 * row per barber serializes exactly the bookings that can conflict and nothing
 * else — two different barbers never wait for each other.
 */
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
      // Outside a transaction the lock would be released immediately and
      // protect nothing. This is a wiring bug, so fail loudly.
      throw new Error('StaffAgendaLock.acquire must run inside a transaction.');
    }

    // Fixed order: two requests locking the same pair of barbers in opposite
    // order would otherwise wait for each other forever.
    const ordered = [...new Set(staffMemberIds)].sort();

    for (const staffMemberId of ordered) {
      await this.context.manager.query(
        'SELECT `id` FROM `staff_members` WHERE `tenant_id` = ? AND `id` = ? FOR UPDATE',
        [tenantId, staffMemberId],
      );
    }
  }
}
