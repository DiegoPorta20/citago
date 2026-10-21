import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClients1789699896955 implements MigrationInterface {
  name = 'AddClients1789699896955';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`clients\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`name\` VARCHAR(120) NOT NULL,
        \`phone_e164\` VARCHAR(20) NULL,
        \`email\` VARCHAR(160) NULL,
        \`notes\` TEXT NULL,
        \`deleted_at\` DATETIME(3) NULL,
        \`created_at\` DATETIME(3) NOT NULL,
        \`updated_at\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_clients_tenant_id\` (\`tenant_id\`, \`id\`),
        UNIQUE INDEX \`uq_clients_tenant_phone\` (\`tenant_id\`, \`phone_e164\`),
        INDEX \`ix_clients_tenant_name\` (\`tenant_id\`, \`name\`),
        CONSTRAINT \`fk_clients_tenant\` FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenants\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `clients`');
  }
}
