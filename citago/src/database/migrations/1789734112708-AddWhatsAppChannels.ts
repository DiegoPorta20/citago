import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsAppChannels1789734112708 implements MigrationInterface {
  name = 'AddWhatsAppChannels1789734112708';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`whatsapp_channels\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`phone_number_id\` VARCHAR(32) NOT NULL,
        \`waba_id\` VARCHAR(32) NULL,
        \`display_phone_number\` VARCHAR(32) NOT NULL,
        \`verified_name\` VARCHAR(255) NULL,
        \`encrypted_access_token\` VARBINARY(2048) NOT NULL,
        \`connected_at\` DATETIME(3) NOT NULL,
        \`created_at\` DATETIME(3) NOT NULL,
        \`updated_at\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_whatsapp_channels_tenant\` (\`tenant_id\`),
        UNIQUE INDEX \`uq_whatsapp_channels_phone_number\` (\`phone_number_id\`),
        CONSTRAINT \`fk_whatsapp_channels_tenant\` FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenants\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `whatsapp_channels`');
  }
}
