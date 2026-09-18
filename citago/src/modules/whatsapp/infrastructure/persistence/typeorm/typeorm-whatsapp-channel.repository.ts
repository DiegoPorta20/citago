import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { WhatsAppChannel } from '../../../domain/whatsapp-channel.entity.js';
import { WhatsAppChannelRepository } from '../../../domain/whatsapp-channel.repository.js';
import { WhatsAppNumberInUseError } from '../../../domain/whatsapp.errors.js';
import { WhatsAppChannelOrmEntity } from './entities/whatsapp-channel.orm-entity.js';

function isDuplicateOn(error: unknown, keyName: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: string; message?: string };

  return (
    driverError.code === 'ER_DUP_ENTRY' &&
    (driverError.message ?? '').includes(keyName)
  );
}

@Injectable()
export class TypeOrmWhatsAppChannelRepository extends WhatsAppChannelRepository {
  constructor(private readonly context: TransactionalEntityManager) {
    super();
  }

  private get repository() {
    return this.context.manager.getRepository(WhatsAppChannelOrmEntity);
  }

  async findByTenant(tenantId: string): Promise<WhatsAppChannel | null> {
    const row = await this.repository.findOneBy({ tenantId });

    return row ? this.toDomain(row) : null;
  }

  async findByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<WhatsAppChannel | null> {
    const row = await this.repository.findOneBy({ phoneNumberId });

    return row ? this.toDomain(row) : null;
  }

  async save(channel: WhatsAppChannel): Promise<void> {
    const row = new WhatsAppChannelOrmEntity();

    Object.assign(row, channel.toSnapshot());

    try {
      await this.repository.save(row);
    } catch (error) {
      if (isDuplicateOn(error, 'uq_whatsapp_channels_phone_number')) {
        throw new WhatsAppNumberInUseError();
      }

      throw error;
    }
  }

  async deleteForTenant(tenantId: string): Promise<void> {
    await this.repository.delete({ tenantId });
  }

  private toDomain(row: WhatsAppChannelOrmEntity): WhatsAppChannel {
    return WhatsAppChannel.restore({
      id: row.id,
      tenantId: row.tenantId,
      phoneNumberId: row.phoneNumberId,
      wabaId: row.wabaId,
      displayPhoneNumber: row.displayPhoneNumber,
      verifiedName: row.verifiedName,
      encryptedAccessToken: row.encryptedAccessToken,
      connectedAt: row.connectedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
