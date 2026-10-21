import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServices1789684045518 implements MigrationInterface {
  name = 'AddServices1789684045518';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`services\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`name\` VARCHAR(120) NOT NULL,
        \`description\` VARCHAR(500) NULL,
        \`duration_minutes\` SMALLINT UNSIGNED NOT NULL,
        \`price\` DECIMAL(12,2) NOT NULL,
        \`status\` ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        \`created_at\` DATETIME(3) NOT NULL,
        \`updated_at\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_services_tenant_id\` (\`tenant_id\`, \`id\`),
        INDEX \`ix_services_tenant_status_name\` (\`tenant_id\`, \`status\`, \`name\`),
        CONSTRAINT \`ck_services_duration_positive\` CHECK (\`duration_minutes\` > 0),
        CONSTRAINT \`ck_services_price_non_negative\` CHECK (\`price\` >= 0),
        CONSTRAINT \`fk_services_tenant\` FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenants\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `services`');
  }
}
