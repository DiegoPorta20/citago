import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantToRefreshTokens1789677885914 implements MigrationInterface {
  name = 'AddTenantToRefreshTokens1789677885914';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
