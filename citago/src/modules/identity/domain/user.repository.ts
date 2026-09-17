import type { Email } from '../../../shared/domain/email.js';
import type { User } from './user.entity.js';

/**
 * Persistence contract for user accounts.
 *
 * Users are platform-wide, so these lookups are **not** tenant-scoped. This is
 * one of the three documented exceptions to the tenant-scoping rule
 * (see docs/adr/0004-tenant-isolation.md): it is the entry door to the system,
 * used before any tenant is known.
 *
 * Declared as an abstract class so it doubles as an injection token.
 */
export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;

  /** Login path: the only lookup allowed without a tenant context. */
  abstract findByEmail(email: Email): Promise<User | null>;

  abstract existsByEmail(email: Email): Promise<boolean>;

  abstract save(user: User): Promise<void>;
}
