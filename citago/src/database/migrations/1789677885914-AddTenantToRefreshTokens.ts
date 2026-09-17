import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A session belongs to one tenant, so the refresh token row records it.
 *
 * Why the column exists at all: the refresh flow resolves the session from the
 * token alone, with no access token to read the tenant from. Storing it here
 * lets that flow call `MembershipRepository.findByIdForTenant(...)` — which
 * means **every** membership read stays tenant-scoped, with no "find by id
 * without a tenant" escape hatch in the repository contract.
 *
 * Safe to apply to a live table: `refresh_tokens` only holds sessions, so
 * clearing them costs users a new sign-in and nothing else.
 */
export class AddTenantToRefreshTokens1789677885914 implements MigrationInterface {
  name = 'AddTenantToRefreshTokens1789677885914';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Existing rows have no tenant to backfill from cheaply, and a session is
    // disposable: drop them instead of guessing.
    await queryRunner.query('DELETE FROM `refresh_tokens`');

    await queryRunner.query(
      'ALTER TABLE `refresh_tokens` ADD COLUMN `tenant_id` CHAR(36) NOT NULL AFTER `user_id`',
    );

    await queryRunner.query(
      'CREATE INDEX `ix_refresh_tokens_tenant` ON `refresh_tokens` (`tenant_id`)',
    );

    await queryRunner.query(
      'ALTER TABLE `refresh_tokens` ADD CONSTRAINT `fk_refresh_tokens_tenant` ' +
        'FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ' +
        'ON DELETE CASCADE ON UPDATE RESTRICT',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `refresh_tokens` DROP FOREIGN KEY `fk_refresh_tokens_tenant`',
    );
    await queryRunner.query(
      'DROP INDEX `ix_refresh_tokens_tenant` ON `refresh_tokens`',
    );
    await queryRunner.query(
      'ALTER TABLE `refresh_tokens` DROP COLUMN `tenant_id`',
    );
  }
}
