import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6a — staff members, their weekly schedule and their time off.
 *
 * First real use of the composite tenant keys from ADR 0004:
 *
 * - `staff_members (tenant_id, user_id) → memberships (tenant_id, user_id)`:
 *   the database refuses to link an account that is not a member of this
 *   business. A NULL `user_id` (a barber without an account) is not checked.
 * - `staff_schedules` and `staff_time_off` point at
 *   `staff_members (tenant_id, id)`, so a schedule can never belong to another
 *   tenant's barber. Both CASCADE: they are part of the staff aggregate.
 *
 * Schedules are `TIME` in the business's wall clock (rule TZ-3); time off is
 * `DATETIME(3)` in UTC like every other instant.
 */
export class AddStaff1789704448728 implements MigrationInterface {
  name = 'AddStaff1789704448728';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`staff_members\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`user_id\` CHAR(36) NULL,
        \`display_name\` VARCHAR(120) NOT NULL,
        \`status\` ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        \`created_at\` DATETIME(3) NOT NULL,
        \`updated_at\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_staff_members_tenant_id\` (\`tenant_id\`, \`id\`),
        UNIQUE INDEX \`uq_staff_members_tenant_user\` (\`tenant_id\`, \`user_id\`),
        CONSTRAINT \`fk_staff_members_tenant\` FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenants\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_staff_members_membership\` FOREIGN KEY (\`tenant_id\`, \`user_id\`)
          REFERENCES \`memberships\` (\`tenant_id\`, \`user_id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`staff_schedules\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`staff_member_id\` CHAR(36) NOT NULL,
        \`weekday\` TINYINT UNSIGNED NOT NULL,
        \`starts_at\` TIME NOT NULL,
        \`ends_at\` TIME NOT NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`ix_staff_schedules_staff\` (\`tenant_id\`, \`staff_member_id\`, \`weekday\`),
        CONSTRAINT \`ck_staff_schedules_weekday\` CHECK (\`weekday\` BETWEEN 1 AND 7),
        CONSTRAINT \`ck_staff_schedules_range\` CHECK (\`ends_at\` > \`starts_at\`),
        CONSTRAINT \`fk_staff_schedules_staff_member\` FOREIGN KEY (\`tenant_id\`, \`staff_member_id\`)
          REFERENCES \`staff_members\` (\`tenant_id\`, \`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`staff_time_off\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`staff_member_id\` CHAR(36) NOT NULL,
        \`starts_at\` DATETIME(3) NOT NULL,
        \`ends_at\` DATETIME(3) NOT NULL,
        \`reason\` VARCHAR(255) NULL,
        \`created_at\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`ix_staff_time_off_staff_start\` (\`tenant_id\`, \`staff_member_id\`, \`starts_at\`),
        CONSTRAINT \`ck_staff_time_off_range\` CHECK (\`ends_at\` > \`starts_at\`),
        CONSTRAINT \`fk_staff_time_off_staff_member\` FOREIGN KEY (\`tenant_id\`, \`staff_member_id\`)
          REFERENCES \`staff_members\` (\`tenant_id\`, \`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `staff_time_off`');
    await queryRunner.query('DROP TABLE `staff_schedules`');
    await queryRunner.query('DROP TABLE `staff_members`');
  }
}
