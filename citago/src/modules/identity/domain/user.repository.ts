import type { Email } from '../../../shared/domain/email.js';
import type { User } from './user.entity.js';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;

  abstract findByEmail(email: Email): Promise<User | null>;

  abstract findManyByIds(ids: readonly string[]): Promise<User[]>;

  abstract existsByEmail(email: Email): Promise<boolean>;

  abstract save(user: User): Promise<void>;
}
