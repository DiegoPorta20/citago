import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';

import type { Email } from '../../../../../shared/domain/email.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { User } from '../../../domain/user.entity.js';
import { UserRepository } from '../../../domain/user.repository.js';
import { UserOrmEntity } from './entities/user.orm-entity.js';

@Injectable()
export class TypeOrmUserRepository extends UserRepository {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get repository() {
    return this.context.manager.getRepository(UserOrmEntity);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.repository.findOneBy({ id });

    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    // The stored value is already normalized by the Email value object, so a
    // plain equality match is enough — no LOWER() that would skip the index.
    const row = await this.repository.findOneBy({ email: email.value });

    return row ? this.toDomain(row) : null;
  }

  async findManyByIds(ids: readonly string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.repository.findBy({ id: In([...ids]) });

    return rows.map((row) => this.toDomain(row));
  }

  async existsByEmail(email: Email): Promise<boolean> {
    return this.repository.existsBy({ email: email.value });
  }

  async save(user: User): Promise<void> {
    const snapshot = user.toSnapshot();
    const row = new UserOrmEntity();

    row.id = snapshot.id;
    row.email = snapshot.email;
    row.passwordHash = snapshot.passwordHash;
    row.name = snapshot.name;
    row.createdAt = snapshot.createdAt;
    row.updatedAt = snapshot.updatedAt;

    await this.repository.save(row);
  }

  private toDomain(row: UserOrmEntity): User {
    return User.restore({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
