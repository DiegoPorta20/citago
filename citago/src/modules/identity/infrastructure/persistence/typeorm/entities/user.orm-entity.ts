import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * A person who can sign in. Platform-wide, not owned by a tenant: access to a
 * business is granted by a membership.
 */
@Entity('users')
export class UserOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  /** Globally unique, so a person keeps one account across businesses. */
  @Index('uq_users_email', { unique: true })
  @Column({ name: 'email', type: 'varchar', length: 160 })
  email: string;

  /** argon2id hash. The plain password never leaves the request. */
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
