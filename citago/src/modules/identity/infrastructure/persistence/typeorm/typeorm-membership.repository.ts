import { Injectable } from '@nestjs/common';

import type { UserRole } from '../../../../../shared/domain/user-role.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { MembershipStatus } from '../../../domain/membership-status.js';
import { Membership } from '../../../domain/membership.entity.js';
import { MembershipRepository } from '../../../domain/membership.repository.js';
import { MembershipOrmEntity } from './entities/membership.orm-entity.js';

@Injectable()
export class TypeOrmMembershipRepository extends MembershipRepository {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get repository() {
    return this.context.manager.getRepository(MembershipOrmEntity);
  }

  /** Tenant-scoped: an id from another tenant simply does not resolve. */
  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Membership | null> {
    const row = await this.repository.findOneBy({ id, tenantId });

    return row ? this.toDomain(row) : null;
  }

  async findActiveByUserId(userId: string): Promise<Membership[]> {
    const rows = await this.repository.find({
      where: { userId, status: MembershipStatus.Active },
      order: { createdAt: 'ASC' },
    });

    return rows.map((row) => this.toDomain(row));
  }

  async findByTenantAndUser(
    tenantId: string,
    userId: string,
  ): Promise<Membership | null> {
    const row = await this.repository.findOneBy({ tenantId, userId });

    return row ? this.toDomain(row) : null;
  }

  /** Supports rule ID-1: a tenant must keep at least one active OWNER. */
  async countActiveByRole(tenantId: string, role: UserRole): Promise<number> {
    return this.repository.countBy({
      tenantId,
      role,
      status: MembershipStatus.Active,
    });
  }

  async save(membership: Membership): Promise<void> {
    const snapshot = membership.toSnapshot();
    const row = new MembershipOrmEntity();

    row.id = snapshot.id;
    row.tenantId = snapshot.tenantId;
    row.userId = snapshot.userId;
    row.role = snapshot.role;
    row.status = snapshot.status;
    row.createdAt = snapshot.createdAt;
    row.updatedAt = snapshot.updatedAt;

    await this.repository.save(row);
  }

  private toDomain(row: MembershipOrmEntity): Membership {
    return Membership.restore({
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
