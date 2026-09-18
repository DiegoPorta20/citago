import type { DataSource } from 'typeorm';
import { v7 as uuidV7 } from 'uuid';

import {
  createTestDataSource,
  queryRows,
  truncateAll,
} from '../../../../test/support/test-data-source.js';
import { PhoneNumber } from '../../../shared/domain/phone-number.js';
import { TransactionalEntityManager } from '../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { TypeOrmTransactionRunner } from '../../../shared/infrastructure/persistence/typeorm-transaction-runner.js';
import { SystemClock } from '../../../shared/infrastructure/system-clock.js';
import { UuidV7IdGenerator } from '../../../shared/infrastructure/uuid-v7-id-generator.js';
import { Client } from '../../clients/domain/client.entity.js';
import { TypeOrmClientRepository } from '../../clients/infrastructure/persistence/typeorm/typeorm-client.repository.js';
import { BusinessType } from '../../tenants/domain/business-type.js';
import { Tenant } from '../../tenants/domain/tenant.entity.js';
import { TypeOrmTenantRepository } from '../../tenants/infrastructure/persistence/typeorm/typeorm-tenant.repository.js';
import {
  ConversationChannel,
  MessageType,
} from '../domain/conversation.enums.js';
import {
  TypeOrmConversationRepository,
  TypeOrmMessageRepository,
} from '../infrastructure/persistence/typeorm/typeorm-conversation.repositories.js';
import {
  RecordInboundMessageUseCase,
  type InboundMessageInput,
} from './record-inbound-message.use-case.js';

const CONTACT = '+51999999999';

describe('RecordInboundMessageUseCase (integration)', () => {
  let dataSource: DataSource;
  let useCase: RecordInboundMessageUseCase;
  let clients: TypeOrmClientRepository;
  let tenantId: string;

  const inbound = (
    overrides: Partial<InboundMessageInput> = {},
  ): InboundMessageInput => ({
    tenantId,
    channel: ConversationChannel.WhatsApp,
    contactIdentifier: CONTACT,
    contactName: 'Juan',
    externalMessageId: `wamid.${uuidV7()}`,
    type: MessageType.Text,
    body: 'Hola, ¿hay turno mañana?',
    sentAt: new Date(),
    ...overrides,
  });

  const count = async (table: 'messages' | 'conversations') =>
    Number(
      (
        await queryRows<{ total: number }>(
          dataSource,
          `SELECT COUNT(*) AS total FROM ${table}`,
        )
      )[0].total,
    );

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    const context = new TransactionalEntityManager(dataSource);
    clients = new TypeOrmClientRepository(context);

    useCase = new RecordInboundMessageUseCase(
      new TypeOrmConversationRepository(context),
      new TypeOrmMessageRepository(context),
      clients,
      new TypeOrmTransactionRunner(dataSource, context),
      new UuidV7IdGenerator(),
      new SystemClock(),
    );
  }, 60_000);

  beforeEach(async () => {
    await truncateAll(dataSource);

    const tenant = Tenant.create(
      {
        id: uuidV7(),
        name: 'Barbería',
        slug: `barberia-${Date.now()}`,
        businessType: BusinessType.Barbershop,
        country: 'PE',
        currency: 'PEN',
        timezone: 'America/Lima',
      },
      new Date(),
    );
    await new TypeOrmTenantRepository(
      new TransactionalEntityManager(dataSource),
    ).save(tenant);
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  it('creates the thread on the first message and marks it pending', async () => {
    const result = await useCase.execute(inbound());

    expect(result.outcome).toBe('recorded');

    const [row] = await queryRows<{
      needs_reply: number;
      contact_name: string;
    }>(dataSource, 'SELECT needs_reply, contact_name FROM conversations');
    expect(Number(row.needs_reply)).toBe(1);
    expect(row.contact_name).toBe('Juan');
  });

  describe('idempotency (rule CO-2)', () => {
    it('stores a retried delivery once', async () => {
      const message = inbound();

      await expect(useCase.execute(message)).resolves.toMatchObject({
        outcome: 'recorded',
      });
      await expect(useCase.execute(message)).resolves.toEqual({
        outcome: 'duplicate',
      });

      expect(await count('messages')).toBe(1);
    });

    it('stores simultaneous copies of the same webhook once', async () => {
      const message = inbound();

      const results = await Promise.all(
        Array.from({ length: 5 }, () => useCase.execute(message)),
      );

      expect(results.filter((r) => r.outcome === 'recorded')).toHaveLength(1);
      expect(results.filter((r) => r.outcome === 'duplicate')).toHaveLength(4);
      expect(await count('messages')).toBe(1);
    });
  });

  describe('concurrency', () => {
    it('creates a single thread when a new contact sends several messages at once', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          useCase.execute(
            inbound({
              body: `mensaje ${index}`,
              sentAt: new Date(Date.now() + index),
            }),
          ),
        ),
      );

      expect(results.every((r) => r.outcome === 'recorded')).toBe(true);
      expect(await count('conversations')).toBe(1);
      expect(await count('messages')).toBe(5);

      // Every message was applied to the thread: none was lost to a race.
      const [row] = await queryRows<{ last_message_preview: string }>(
        dataSource,
        'SELECT last_message_preview FROM conversations',
      );
      expect(row.last_message_preview).toBe('mensaje 4');
    });
  });

  describe('client linking (rule CO-6)', () => {
    it('links the thread when the number already belongs to a client', async () => {
      const client = Client.create(
        {
          id: uuidV7(),
          tenantId,
          name: 'Juan Pérez',
          phone: PhoneNumber.fromE164(CONTACT),
        },
        new Date(),
      );
      await clients.save(client);

      await useCase.execute(inbound());

      const [row] = await queryRows<{ client_id: string | null }>(
        dataSource,
        'SELECT client_id FROM conversations',
      );
      expect(row.client_id).toBe(client.id);
    });

    it('leaves an unknown number unlinked, and creates no client', async () => {
      await useCase.execute(inbound());

      const [row] = await queryRows<{ client_id: string | null }>(
        dataSource,
        'SELECT client_id FROM conversations',
      );
      expect(row.client_id).toBeNull();

      const [clientCount] = await queryRows<{ total: number }>(
        dataSource,
        'SELECT COUNT(*) AS total FROM clients',
      );
      expect(Number(clientCount.total)).toBe(0);
    });

    it('does not link a deleted client', async () => {
      const client = Client.create(
        {
          id: uuidV7(),
          tenantId,
          name: 'Borrado',
          phone: PhoneNumber.fromE164(CONTACT),
        },
        new Date(),
      );
      client.softDelete(new Date());
      await clients.save(client);

      await useCase.execute(inbound());

      const [row] = await queryRows<{ client_id: string | null }>(
        dataSource,
        'SELECT client_id FROM conversations',
      );
      expect(row.client_id).toBeNull();
    });

    it('links a thread later, once the number becomes a client', async () => {
      await useCase.execute(inbound());

      await clients.save(
        Client.create(
          {
            id: uuidV7(),
            tenantId,
            name: 'Juan Pérez',
            phone: PhoneNumber.fromE164(CONTACT),
          },
          new Date(),
        ),
      );

      await useCase.execute(inbound());

      const [row] = await queryRows<{ client_id: string | null }>(
        dataSource,
        'SELECT client_id FROM conversations',
      );
      expect(row.client_id).not.toBeNull();
    });
  });
});
