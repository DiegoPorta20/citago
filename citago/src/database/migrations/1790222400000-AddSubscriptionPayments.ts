import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionPayments1790222400000 implements MigrationInterface {
  name = 'AddSubscriptionPayments1790222400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`subscriptions\`
        ADD COLUMN \`gateway_subscription_id\` VARCHAR(64) NULL AFTER \`trial_ends_at\`,
        ADD COLUMN \`gateway_customer_id\` VARCHAR(64) NULL AFTER \`gateway_subscription_id\`,
        ADD COLUMN \`current_period_end\` DATETIME(3) NULL AFTER \`gateway_customer_id\`,
        ADD COLUMN \`canceled_at\` DATETIME(3) NULL AFTER \`current_period_end\`,
        ADD COLUMN \`last_synced_at\` DATETIME(3) NULL AFTER \`canceled_at\`,
        ADD UNIQUE INDEX \`uq_subscriptions_gateway_subscription\` (\`gateway_subscription_id\`)
    `);

    await queryRunner.query(`
      CREATE TABLE \`subscription_notices\` (
        \`id\` CHAR(36) NOT NULL,
        \`subscription_id\` CHAR(36) NOT NULL,
        \`kind\` VARCHAR(32) NOT NULL,
        \`ref\` VARCHAR(32) NOT NULL,
        \`sent_at\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_subscription_notices_once\` (\`subscription_id\`, \`kind\`, \`ref\`),
        CONSTRAINT \`fk_subscription_notices_subscription\` FOREIGN KEY (\`subscription_id\`)
          REFERENCES \`subscriptions\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `subscription_notices`');
    await queryRunner.query(`
      ALTER TABLE \`subscriptions\`
        DROP INDEX \`uq_subscriptions_gateway_subscription\`,
        DROP COLUMN \`last_synced_at\`,
        DROP COLUMN \`canceled_at\`,
        DROP COLUMN \`current_period_end\`,
        DROP COLUMN \`gateway_customer_id\`,
        DROP COLUMN \`gateway_subscription_id\`
    `);
  }
}
