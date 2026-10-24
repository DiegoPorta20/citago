import type { MigrationInterface, QueryRunner } from 'typeorm';
import { v7 as uuidV7 } from 'uuid';

const TRIAL_DAYS = 7;

export class AddSubscriptions1790136000000 implements MigrationInterface {
  name = 'AddSubscriptions1790136000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`subscriptions\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`plan_code\` ENUM('STARTER','PRO','BUSINESS') NOT NULL,
        \`trial_ends_at\` DATETIME(3) NOT NULL,
        \`created_at\` DATETIME(3) NOT NULL,
        \`updated_at\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_subscriptions_tenant\` (\`tenant_id\`),
        CONSTRAINT \`fk_subscriptions_tenant\` FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenants\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // Businesses that already exist get a fresh trial from today, so shipping
    // billing never locks anyone out the moment it is deployed.
    const tenants = (await queryRunner.query('SELECT `id` FROM `tenants`')) as {
      id: string;
    }[];
    const now = new Date();
    const trialEndsAt = new Date(
      now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
    );

    for (const tenant of tenants) {
      await queryRunner.query(
        'INSERT INTO `subscriptions` (`id`, `tenant_id`, `plan_code`, `trial_ends_at`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidV7(), tenant.id, 'PRO', trialEndsAt, now, now],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `subscriptions`');
  }
}
