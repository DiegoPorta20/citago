import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6b — appointments and their status history.
 *
 * - Every reference carries `tenant_id` (ADR 0004, layer 4): an appointment
 *   cannot point at another tenant's client, service or barber, even through a
 *   bug in the application.
 * - All RESTRICT: deleting a client, service or barber must never cascade into
 *   history. They are soft-deleted or deactivated instead.
 * - `price` and `end_at` are snapshots taken at booking (rules AP-1, AP-2).
 * - The CHECKs hold even for hand-written SQL.
 *
 * Overlaps are not expressible as a constraint in MySQL; they are prevented by
 * the agenda lock plus the domain policy (rule AP-5).
 */
export class AddAppointments1789704978659 implements MigrationInterface {
  name = 'AddAppointments1789704978659';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`appointments\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`client_id\` CHAR(36) NOT NULL,
        \`service_id\` CHAR(36) NOT NULL,
        \`staff_member_id\` CHAR(36) NOT NULL,
        \`start_at\` DATETIME(3) NOT NULL,
        \`end_at\` DATETIME(3) NOT NULL,
        \`status\` ENUM('PENDING','CONFIRMED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW')
          NOT NULL DEFAULT 'PENDING',
        \`price\` DECIMAL(12,2) NOT NULL,
        \`notes\` VARCHAR(500) NULL,
        \`source\` ENUM('MANUAL','WHATSAPP','APP','OTHER') NOT NULL DEFAULT 'MANUAL',
        \`created_by_user_id\` CHAR(36) NULL,
        \`completed_at\` DATETIME(3) NULL,
        \`cancelled_at\` DATETIME(3) NULL,
        \`cancellation_reason\` VARCHAR(255) NULL,
        \`created_at\` DATETIME(3) NOT NULL,
        \`updated_at\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_appointments_tenant_id\` (\`tenant_id\`, \`id\`),
        INDEX \`ix_appointments_staff_start\` (\`tenant_id\`, \`staff_member_id\`, \`start_at\`),
        INDEX \`ix_appointments_start\` (\`tenant_id\`, \`start_at\`),
        INDEX \`ix_appointments_client_start\` (\`tenant_id\`, \`client_id\`, \`start_at\`),
        CONSTRAINT \`ck_appointments_range\` CHECK (\`end_at\` > \`start_at\`),
        CONSTRAINT \`ck_appointments_price\` CHECK (\`price\` >= 0),
        CONSTRAINT \`fk_appointments_client\` FOREIGN KEY (\`tenant_id\`, \`client_id\`)
          REFERENCES \`clients\` (\`tenant_id\`, \`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_appointments_service\` FOREIGN KEY (\`tenant_id\`, \`service_id\`)
          REFERENCES \`services\` (\`tenant_id\`, \`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_appointments_staff_member\` FOREIGN KEY (\`tenant_id\`, \`staff_member_id\`)
          REFERENCES \`staff_members\` (\`tenant_id\`, \`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_appointments_created_by\` FOREIGN KEY (\`created_by_user_id\`)
          REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`appointment_status_history\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`appointment_id\` CHAR(36) NOT NULL,
        \`from_status\` VARCHAR(20) NULL,
        \`to_status\` VARCHAR(20) NOT NULL,
        \`reason\` VARCHAR(255) NULL,
        \`changed_by_user_id\` CHAR(36) NULL,
        \`changed_at\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`ix_appointment_history_appointment\` (\`tenant_id\`, \`appointment_id\`, \`changed_at\`),
        CONSTRAINT \`fk_appointment_history_appointment\` FOREIGN KEY (\`tenant_id\`, \`appointment_id\`)
          REFERENCES \`appointments\` (\`tenant_id\`, \`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `appointment_status_history`');
    await queryRunner.query('DROP TABLE `appointments`');
  }
}
