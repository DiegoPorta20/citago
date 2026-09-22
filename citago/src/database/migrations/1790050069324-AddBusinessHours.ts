import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Opening hours of the business.
 *
 * `TIME` in the business's wall clock, like `staff_schedules` (rule TZ-3): a
 * shop opens at nine o'clock on its own clock, and daylight saving does not
 * move that.
 *
 * CASCADE from the tenant because the hours are part of it, not a record of
 * their own — the only cascade allowed by ADR 0004, which is why it points at
 * `tenants(id)` and not at a composite key.
 */
export class AddBusinessHours1790050069324 implements MigrationInterface {
  name = 'AddBusinessHours1790050069324';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`business_hours\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`weekday\` TINYINT UNSIGNED NOT NULL,
        \`starts_at\` TIME NOT NULL,
        \`ends_at\` TIME NOT NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`ix_business_hours_tenant\` (\`tenant_id\`, \`weekday\`),
        CONSTRAINT \`ck_business_hours_weekday\` CHECK (\`weekday\` BETWEEN 1 AND 7),
        CONSTRAINT \`ck_business_hours_range\` CHECK (\`ends_at\` > \`starts_at\`),
        CONSTRAINT \`fk_business_hours_tenant\` FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `business_hours`');
  }
}
