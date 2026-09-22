import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 9 — sales and their lines.
 *
 * - `currency`, `description` and `unit_price` are snapshots (rules SA-6, SA-7):
 *   changing the price list tomorrow must not rewrite what a client paid today.
 * - The amounts are checked by the database too (rule SA-2): `total` is always
 *   `subtotal - discount`, and a discount can never exceed the subtotal. Even a
 *   hand-written UPDATE cannot leave a till that does not add up.
 * - `uq_sales_appointment` enforces rule SA-3 — one appointment, one sale.
 *   MySQL does not compare NULLs in a unique index, so counter sales, which
 *   have no appointment, are unaffected.
 * - Every reference carries `tenant_id` (ADR 0004, layer 4) and is RESTRICT:
 *   takings are history and are never cascaded away. The only CASCADE is from a
 *   sale to its own lines, which are part of it.
 */
export class AddSales1790041223146 implements MigrationInterface {
  name = 'AddSales1790041223146';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`sales\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`appointment_id\` CHAR(36) NULL,
        \`client_id\` CHAR(36) NULL,
        \`staff_member_id\` CHAR(36) NULL,
        \`status\` ENUM('PENDING','PAID','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING',
        \`currency\` CHAR(3) NOT NULL,
        \`subtotal\` DECIMAL(12,2) NOT NULL,
        \`discount\` DECIMAL(12,2) NOT NULL,
        \`total\` DECIMAL(12,2) NOT NULL,
        \`payment_method\` ENUM('CASH','CARD','TRANSFER','OTHER') NULL,
        \`sold_at\` DATETIME(3) NOT NULL,
        \`paid_at\` DATETIME(3) NULL,
        \`voided_at\` DATETIME(3) NULL,
        \`void_reason\` VARCHAR(255) NULL,
        \`voided_by_user_id\` CHAR(36) NULL,
        \`created_by_user_id\` CHAR(36) NULL,
        \`created_at\` DATETIME(3) NOT NULL,
        \`updated_at\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_sales_tenant_id\` (\`tenant_id\`, \`id\`),
        UNIQUE INDEX \`uq_sales_appointment\` (\`tenant_id\`, \`appointment_id\`),
        INDEX \`ix_sales_sold_at\` (\`tenant_id\`, \`sold_at\`),
        INDEX \`ix_sales_staff_sold_at\` (\`tenant_id\`, \`staff_member_id\`, \`sold_at\`),
        INDEX \`ix_sales_client_sold_at\` (\`tenant_id\`, \`client_id\`, \`sold_at\`),
        CONSTRAINT \`ck_sales_amounts\` CHECK (
          \`subtotal\` >= 0 AND \`discount\` >= 0 AND \`discount\` <= \`subtotal\`
          AND \`total\` = \`subtotal\` - \`discount\`
        ),
        CONSTRAINT \`fk_sales_appointment\` FOREIGN KEY (\`tenant_id\`, \`appointment_id\`)
          REFERENCES \`appointments\` (\`tenant_id\`, \`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_sales_client\` FOREIGN KEY (\`tenant_id\`, \`client_id\`)
          REFERENCES \`clients\` (\`tenant_id\`, \`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_sales_staff_member\` FOREIGN KEY (\`tenant_id\`, \`staff_member_id\`)
          REFERENCES \`staff_members\` (\`tenant_id\`, \`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_sales_created_by\` FOREIGN KEY (\`created_by_user_id\`)
          REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_sales_voided_by\` FOREIGN KEY (\`voided_by_user_id\`)
          REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`sale_lines\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`sale_id\` CHAR(36) NOT NULL,
        \`service_id\` CHAR(36) NULL,
        \`description\` VARCHAR(160) NOT NULL,
        \`unit_price\` DECIMAL(12,2) NOT NULL,
        \`quantity\` SMALLINT UNSIGNED NOT NULL,
        \`line_total\` DECIMAL(12,2) NOT NULL,
        \`position\` SMALLINT UNSIGNED NOT NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`ix_sale_lines_sale\` (\`tenant_id\`, \`sale_id\`, \`position\`),
        CONSTRAINT \`ck_sale_lines_amounts\` CHECK (
          \`unit_price\` >= 0 AND \`quantity\` > 0
          AND \`line_total\` = \`unit_price\` * \`quantity\`
        ),
        CONSTRAINT \`fk_sale_lines_sale\` FOREIGN KEY (\`tenant_id\`, \`sale_id\`)
          REFERENCES \`sales\` (\`tenant_id\`, \`id\`) ON DELETE CASCADE ON UPDATE RESTRICT,
        CONSTRAINT \`fk_sale_lines_service\` FOREIGN KEY (\`tenant_id\`, \`service_id\`)
          REFERENCES \`services\` (\`tenant_id\`, \`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `sale_lines`');
    await queryRunner.query('DROP TABLE `sales`');
  }
}
