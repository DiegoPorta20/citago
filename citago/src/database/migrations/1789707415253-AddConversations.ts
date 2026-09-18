import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7 — conversations and messages.
 *
 * - `uq_conversations_contact (tenant_id, channel, contact_identifier)`: one
 *   thread per contact (decision F11), and the arbiter when two first messages
 *   from the same contact arrive at the same time.
 * - `uq_messages_external_id`: **global** idempotency key for channel messages
 *   (rule CO-2). NULLs (messages without a channel id) do not collide.
 * - Composite tenant keys everywhere: a conversation can only point at a client
 *   of its tenant, only be assigned to a member of its tenant, and a message
 *   only belong to a conversation of its tenant.
 * - Messages CASCADE with their conversation (same aggregate); nothing else
 *   cascades.
 */
export class AddConversations1789707415253 implements MigrationInterface {
  name = 'AddConversations1789707415253';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`conversations\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`channel\` ENUM('WHATSAPP','INSTAGRAM','MESSENGER','WEB','OTHER') NOT NULL,
        \`contact_identifier\` VARCHAR(64) NOT NULL,
        \`contact_name\` VARCHAR(120) NULL,
        \`client_id\` CHAR(36) NULL,
        \`assigned_user_id\` CHAR(36) NULL,
        \`status\` ENUM('OPEN','ARCHIVED') NOT NULL DEFAULT 'OPEN',
        \`needs_reply\` TINYINT NOT NULL DEFAULT 0,
        \`last_message_at\` DATETIME(3) NULL,
        \`last_inbound_at\` DATETIME(3) NULL,
        \`last_outbound_at\` DATETIME(3) NULL,
        \`last_message_preview\` VARCHAR(120) NULL,
        \`created_at\` DATETIME(3) NOT NULL,
        \`updated_at\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_conversations_tenant_id\` (\`tenant_id\`, \`id\`),
        UNIQUE INDEX \`uq_conversations_contact\` (\`tenant_id\`, \`channel\`, \`contact_identifier\`),
        INDEX \`ix_conversations_needs_reply\` (\`tenant_id\`, \`needs_reply\`, \`last_message_at\`),
        INDEX \`ix_conversations_status\` (\`tenant_id\`, \`status\`, \`last_message_at\`),
        INDEX \`ix_conversations_client\` (\`tenant_id\`, \`client_id\`),
        CONSTRAINT \`fk_conversations_tenant\` FOREIGN KEY (\`tenant_id\`)
          REFERENCES \`tenants\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_conversations_client\` FOREIGN KEY (\`tenant_id\`, \`client_id\`)
          REFERENCES \`clients\` (\`tenant_id\`, \`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_conversations_assignee\` FOREIGN KEY (\`tenant_id\`, \`assigned_user_id\`)
          REFERENCES \`memberships\` (\`tenant_id\`, \`user_id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`messages\` (
        \`id\` CHAR(36) NOT NULL,
        \`tenant_id\` CHAR(36) NOT NULL,
        \`conversation_id\` CHAR(36) NOT NULL,
        \`external_message_id\` VARCHAR(128) NULL,
        \`direction\` ENUM('INBOUND','OUTBOUND') NOT NULL,
        \`type\` ENUM('TEXT','IMAGE','AUDIO','VIDEO','DOCUMENT','LOCATION','OTHER') NOT NULL,
        \`body\` TEXT NULL,
        \`media_reference\` VARCHAR(255) NULL,
        \`media_mime_type\` VARCHAR(100) NULL,
        \`sent_at\` DATETIME(3) NOT NULL,
        \`received_at\` DATETIME(3) NOT NULL,
        \`author_user_id\` CHAR(36) NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_messages_external_id\` (\`external_message_id\`),
        INDEX \`ix_messages_conversation_sent\` (\`tenant_id\`, \`conversation_id\`, \`sent_at\`, \`id\`),
        CONSTRAINT \`fk_messages_conversation\` FOREIGN KEY (\`tenant_id\`, \`conversation_id\`)
          REFERENCES \`conversations\` (\`tenant_id\`, \`id\`) ON DELETE CASCADE ON UPDATE RESTRICT,
        CONSTRAINT \`fk_messages_author\` FOREIGN KEY (\`author_user_id\`)
          REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `messages`');
    await queryRunner.query('DROP TABLE `conversations`');
  }
}
