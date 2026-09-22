import type { DataSource } from 'typeorm';
import { v7 as uuidV7 } from 'uuid';

import {
  createTestDataSource,
  truncateAll,
} from '../../../../../../test/support/test-data-source.js';
import { Money } from '../../../../../shared/domain/money.js';
import { UuidV7IdGenerator } from '../../../../../shared/infrastructure/uuid-v7-id-generator.js';
import { TransactionalEntityManager } from '../../../../../shared/infrastructure/persistence/transactional-entity-manager.js';
import { BusinessType } from '../../../../tenants/domain/business-type.js';
import { Tenant } from '../../../../tenants/domain/tenant.entity.js';
import { TypeOrmTenantRepository } from '../../../../tenants/infrastructure/persistence/typeorm/typeorm-tenant.repository.js';
import { Client } from '../../../../clients/domain/client.entity.js';
import { TypeOrmClientRepository } from '../../../../clients/infrastructure/persistence/typeorm/typeorm-client.repository.js';
import { PaymentMethod } from '../../../domain/payment-method.js';
import { Sale } from '../../../domain/sale.entity.js';
import { SaleLine } from '../../../domain/sale-line.js';
import { SaleStatus } from '../../../domain/sale-status.js';
import { TypeOrmSaleRepository } from './typeorm-sale.repository.js';

const NOW = new Date('2026-09-21T15:00:00.000Z');

/**
 * What the database guarantees about the till, independently of the
 * application: the amounts add up, an appointment is charged once, and a sale
 * never reaches across tenants.
 */
describe('TypeOrmSaleRepository (integration)', () => {
  let dataSource: DataSource;
  let sales: TypeOrmSaleRepository;
  let tenants: TypeOrmTenantRepository;
  let clients: TypeOrmClientRepository;
  let tenantA: string;
  let tenantB: string;

  const createTenant = async (slug: string): Promise<string> => {
    const tenant = Tenant.create(
      {
        id: uuidV7(),
        name: slug,
        slug,
        businessType: BusinessType.Barbershop,
        country: 'PE',
        currency: 'PEN',
        timezone: 'America/Lima',
      },
      NOW,
    );

    await tenants.save(tenant);

    return tenant.id;
  };

  const createClient = async (tenantId: string): Promise<string> => {
    const client = Client.create(
      { id: uuidV7(), tenantId, name: 'Juan Pérez', phone: null },
      NOW,
    );

    await clients.save(client);

    return client.id;
  };

  const line = (unitPrice: string, quantity = 1): SaleLine =>
    SaleLine.of({
      id: uuidV7(),
      description: 'Corte de cabello',
      unitPrice: Money.fromDecimalString(unitPrice),
      quantity,
    });

  const newSale = (
    tenantId: string,
    options: {
      clientId?: string | null;
      lines?: SaleLine[];
      discount?: string;
      paymentMethod?: PaymentMethod | null;
    } = {},
  ): Sale =>
    Sale.register(
      {
        id: uuidV7(),
        tenantId,
        clientId: options.clientId ?? null,
        currency: 'PEN',
        lines: options.lines ?? [line('25.00')],
        discount: options.discount
          ? Money.fromDecimalString(options.discount)
          : undefined,
        paymentMethod: options.paymentMethod ?? null,
        createdByUserId: null,
      },
      NOW,
    );

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    const context = new TransactionalEntityManager(dataSource);

    sales = new TypeOrmSaleRepository(context);
    tenants = new TypeOrmTenantRepository(context, new UuidV7IdGenerator());
    clients = new TypeOrmClientRepository(context);
  }, 60_000);

  beforeEach(async () => {
    await truncateAll(dataSource);
    tenantA = await createTenant('ventas-a');
    tenantB = await createTenant('ventas-b');
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  describe('round trip', () => {
    it('stores a sale with its lines and reads it back whole', async () => {
      const clientId = await createClient(tenantA);
      const sale = newSale(tenantA, {
        clientId,
        lines: [line('25.00', 2), line('10.50')],
        discount: '5.00',
        paymentMethod: PaymentMethod.Card,
      });

      await sales.save(sale);

      const stored = await sales.findByIdForTenant(sale.id, tenantA);

      expect(stored?.toSnapshot()).toEqual(sale.toSnapshot());
      expect(stored?.lines).toHaveLength(2);
    });

    it('keeps the stored amounts in step with the lines', async () => {
      const sale = newSale(tenantA, {
        lines: [line('25.00', 2)],
        discount: '5.00',
      });

      await sales.save(sale);

      const [row] = await dataSource.query<
        { subtotal: string; discount: string; total: string }[]
      >('SELECT subtotal, discount, total FROM sales WHERE id = ?', [sale.id]);

      expect(row).toEqual({
        subtotal: '50.00',
        discount: '5.00',
        total: '45.00',
      });
    });

    it('rewrites only the status when the sale is charged', async () => {
      const sale = newSale(tenantA);

      await sales.save(sale);
      sale.transitionTo(
        SaleStatus.Paid,
        { actorUserId: null, paymentMethod: PaymentMethod.Cash },
        NOW,
      );
      await sales.save(sale);

      const stored = await sales.findByIdForTenant(sale.id, tenantA);

      expect(stored?.status).toBe(SaleStatus.Paid);
      expect(stored?.lines).toHaveLength(1);
    });
  });

  describe('amount constraints (rule SA-2)', () => {
    it('refuses a total that is not subtotal minus discount', async () => {
      const sale = newSale(tenantA);

      await sales.save(sale);

      await expect(
        dataSource.query('UPDATE sales SET total = ? WHERE id = ?', [
          '999.00',
          sale.id,
        ]),
      ).rejects.toThrow(/Check constraint/i);
    });

    it('refuses a discount above the subtotal', async () => {
      const sale = newSale(tenantA);

      await sales.save(sale);

      await expect(
        dataSource.query(
          'UPDATE sales SET discount = ?, total = ? WHERE id = ?',
          ['30.00', '-5.00', sale.id],
        ),
      ).rejects.toThrow(/Check constraint/i);
    });

    it('refuses a line whose total is not price times quantity', async () => {
      const sale = newSale(tenantA);

      await sales.save(sale);

      await expect(
        dataSource.query(
          'UPDATE sale_lines SET quantity = 3 WHERE sale_id = ?',
          [sale.id],
        ),
      ).rejects.toThrow(/Check constraint/i);
    });
  });

  describe('tenant isolation (ADR 0004, layer 4)', () => {
    it('does not return a sale of another tenant', async () => {
      const sale = newSale(tenantA);

      await sales.save(sale);

      await expect(
        sales.findByIdForTenant(sale.id, tenantB),
      ).resolves.toBeNull();
    });

    it("refuses a sale pointing at another tenant's client", async () => {
      const foreignClient = await createClient(tenantB);

      await expect(
        sales.save(newSale(tenantA, { clientId: foreignClient })),
      ).rejects.toThrow(/foreign key/i);
    });
  });

  describe('lines belong to their sale', () => {
    it('removes them with it, and only with it', async () => {
      const sale = newSale(tenantA);

      await sales.save(sale);
      await dataSource.query('DELETE FROM sales WHERE id = ?', [sale.id]);

      const remaining = await dataSource.query<{ count: number }[]>(
        'SELECT COUNT(*) AS count FROM sale_lines WHERE sale_id = ?',
        [sale.id],
      );

      expect(Number(remaining[0].count)).toBe(0);
    });
  });
});
