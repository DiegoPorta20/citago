import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 — clients.
 *
 * - `UNIQUE(tenant_id, phone_e164)` makes the phone the customer's identity
 *   inside a business (rule CL-2). MySQL accepts any number of NULLs in a
 *   unique index, so clients registered without a phone never collide.
 * - `UNIQUE(tenant_id, id)` is the target of the composite foreign keys that
 *   appointments and sales will use (ADR 0004).
 * - `deleted_at` implements soft delete (rule CL-3). A deleted client keeps its
 *   phone on purpose: re-registering the number offers a restore instead of
 *   splitting the person's history in two.
 */
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
