import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { TenantOrmEntity } from '../../../../../tenants/infrastructure/persistence/typeorm/entities/tenant.orm-entity.js';

@Entity('whatsapp_channels')
/** One WhatsApp number per business in the MVP. */
@Unique('uq_whatsapp_channels_tenant', ['tenantId'])
/** A number belongs to one business: it decides where inbound messages go (rule CO-5). */
@Unique('uq_whatsapp_channels_phone_number', ['phoneNumberId'])
export class WhatsAppChannelOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'phone_number_id', type: 'varchar', length: 32 })
  phoneNumberId: string;

  @Column({ name: 'waba_id', type: 'varchar', length: 32, nullable: true })
  wabaId: string | null;

  @Column({ name: 'display_phone_number', type: 'varchar', length: 32 })
  displayPhoneNumber: string;

  @Column({
    name: 'verified_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  verifiedName: string | null;

  /** AES-256-GCM ciphertext. Never plaintext. */
  @Column({ name: 'encrypted_access_token', type: 'varbinary', length: 2048 })
  encryptedAccessToken: Buffer;

  @Column({ name: 'connected_at', type: 'datetime', precision: 3 })
  connectedAt: Date;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @ManyToOne(() => TenantOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_whatsapp_channels_tenant',
  })
  tenant?: TenantOrmEntity;
}
