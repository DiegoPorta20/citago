import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Money } from '../../../shared/domain/money.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { type ClientRepository } from '../../clients/domain/client.repository.js';
import { type StaffRepository } from '../../staff/domain/staff.repository.js';
import { PaymentMethod } from '../domain/payment-method.js';
import { Sale } from '../domain/sale.entity.js';
import { SaleLine } from '../domain/sale-line.js';
import { SaleNotFoundError } from '../domain/sale.errors.js';
import { type SaleRepository } from '../domain/sale.repository.js';
import {
  GetSaleByAppointmentUseCase,
  SaleViewAssembler,
} from './sale-queries.js';
import { type SalesAccess } from './sales-access.js';

const owner: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  role: UserRole.Owner,
};

function billedSale(): Sale {
  return Sale.register(
    {
      id: 'sale-1',
      tenantId: 'tenant-1',
      appointmentId: 'appointment-1',
      clientId: null,
      staffMemberId: 'staff-1',
      currency: 'PEN',
      lines: [
        SaleLine.of({
          id: 'line-1',
          description: 'Corte',
          unitPrice: Money.fromDecimalString('25.00'),
          quantity: 1,
        }),
      ],
      paymentMethod: PaymentMethod.Cash,
      createdByUserId: 'user-1',
    },
    new Date('2026-10-23T15:00:00Z'),
  );
}

function build(options: { sale: Sale | null; denied?: boolean }) {
  const lookups: [string, string][] = [];
  const sales = {
    findByAppointmentId: (tenantId: string, appointmentId: string) => {
      lookups.push([tenantId, appointmentId]);

      return Promise.resolve(options.sale);
    },
  } as unknown as SaleRepository;
  const access = {
    assertCanSee: () =>
      options.denied
        ? Promise.reject(new SaleNotFoundError())
        : Promise.resolve(),
  } as unknown as SalesAccess;
  const nobody = { findManyByIdsForTenant: () => Promise.resolve([]) };
  const assembler = new SaleViewAssembler(
    nobody as unknown as ClientRepository,
    nobody as unknown as StaffRepository,
  );

  return {
    lookups,
    useCase: new GetSaleByAppointmentUseCase(sales, access, assembler),
  };
}

describe('GetSaleByAppointmentUseCase', () => {
  it('returns the sale that charged the appointment, scoped to the tenant', async () => {
    const { useCase, lookups } = build({ sale: billedSale() });

    const view = await useCase.execute(owner, 'appointment-1');

    expect(view.sale.id).toBe('sale-1');
    expect(lookups).toEqual([['tenant-1', 'appointment-1']]);
  });

  it('answers SALE_NOT_FOUND while the appointment has not been billed', async () => {
    const { useCase } = build({ sale: null });

    await expect(useCase.execute(owner, 'appointment-1')).rejects.toThrow(
      SaleNotFoundError,
    );
  });

  it('hides a sale the actor may not see', async () => {
    const { useCase } = build({ sale: billedSale(), denied: true });

    await expect(useCase.execute(owner, 'appointment-1')).rejects.toThrow(
      SaleNotFoundError,
    );
  });
});
