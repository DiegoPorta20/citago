import { Injectable } from '@nestjs/common';
import { IsNull, LessThanOrEqual } from 'typeorm';

import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import {
  RefreshTokenRepository,
  type NewRefreshToken,
  type StoredRefreshToken,
} from '../../../application/ports/refresh-token.repository.js';
import { RefreshTokenOrmEntity } from './entities/refresh-token.orm-entity.js';

@Injectable()
export class TypeOrmRefreshTokenRepository extends RefreshTokenRepository {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get repository() {
    return this.context.manager.getRepository(RefreshTokenOrmEntity);
  }

  async insert(token: NewRefreshToken): Promise<void> {
    await this.repository.insert({
      id: token.id,
      userId: token.userId,
      tenantId: token.tenantId,
      membershipId: token.membershipId,
      tokenHash: token.tokenHash,
      familyId: token.familyId,
      expiresAt: token.expiresAt,
      revokedAt: null,
      replacedById: null,
      createdAt: token.createdAt,
    });
  }

  async findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    const row = await this.repository.findOneBy({ tokenHash });

    return row
      ? {
          id: row.id,
          userId: row.userId,
          tenantId: row.tenantId,
          membershipId: row.membershipId,
          tokenHash: row.tokenHash,
          familyId: row.familyId,
          expiresAt: row.expiresAt,
          revokedAt: row.revokedAt,
          replacedById: row.replacedById,
          createdAt: row.createdAt,
        }
      : null;
  }

  async markRotated(
    id: string,
    replacedById: string,
    rotatedAt: Date,
  ): Promise<void> {
    await this.repository.update(
      { id },
      { replacedById, revokedAt: rotatedAt },
    );
  }

  async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    // Only tokens still alive are touched, so an earlier revocation timestamp
    // is preserved for auditing.
    await this.repository.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt },
    );
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.repository.delete({
      expiresAt: LessThanOrEqual(now),
    });

    return result.affected ?? 0;
  }
}
