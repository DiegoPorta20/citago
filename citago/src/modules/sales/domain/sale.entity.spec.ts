import { Money } from '../../../shared/domain/money.js';
import { PaymentMethod } from './payment-method.js';
import { Sale } from './sale.entity.js';
import { SaleLine } from './sale-line.js';
import {
  DiscountAboveSubtotalError,
  InvalidSaleDataError,
  InvalidSaleTransitionError,
  PaymentMethodRequiredError,
  VoidReasonRequiredError,
} from './sale.errors.js';
import {
  ALLOWED_TRANSITIONS,
  countsAsRevenue,
  SaleStatus,
} from './sale-status.js';

const S = SaleStatus;
const SOLD_AT = new Date('2026-09-21T15:00:00Z');
const LATER = new Date('2026-09-21T16:00:00Z');

let sequence = 0;

function line(unitPrice: string, quantity = 1, serviceId?: string): SaleLine {
  sequence += 1;

  return SaleLine.of({
    id: `line-${sequence}`,
    serviceId,
    description: 'Corte de cabello',
    unitPrice: Money.fromDecimalString(unitPrice),
    quantity,
  });
}

function register(
  lines: SaleLine[] = [line('25.00')],
  overrides: {
    discount?: string;
    paymentMethod?: PaymentMethod | null;
  } = {},
): Sale {
  sequence += 1;

  return Sale.register(
    {
      id: `sale-${sequence}`,
      tenantId: 'tenant-1',
      clientId: 'client-1',
      staffMemberId: 'staff-1',
      currency: 'PEN',
      lines,
      discount: overrides.discount
        ? Money.fromDecimalString(overrides.discount)
        : undefined,
      paymentMethod: overrides.paymentMethod ?? null,
      createdByUserId: 'user-1',
    },
    SOLD_AT,
  );
}

describe('Sale', () => {
  describe('amounts (rules SA-1, SA-2)', () => {
    it('derives the subtotal from the lines and the total from the discount', () => {
      const sale = register([line('25.00', 2), line('10.50')], {
        discount: '5.00',
      });

      expect(sale.subtotal.toDecimalString()).toBe('60.50');
      expect(sale.total.toDecimalString()).toBe('55.50');
    });

    it('adds cents exactly', () => {
      const sale = register([line('0.10'), line('0.20')]);

      expect(sale.total.toDecimalString()).toBe('0.30');
    });

    it('refuses a discount larger than the subtotal', () => {
      expect(() => register([line('25.00')], { discount: '25.01' })).toThrow(
        DiscountAboveSubtotalError,
      );
    });

    it('accepts a discount equal to the subtotal', () => {
      const sale = register([line('25.00')], { discount: '25.00' });

      expect(sale.total.toDecimalString()).toBe('0.00');
    });

    it('refuses a sale with no lines', () => {
      expect(() => register([])).toThrow(InvalidSaleDataError);
    });
  });

  describe('lines as snapshots (rule SA-7)', () => {
    it('keeps the description and unit price it was given', () => {
      const [snapshot] = register([line('25.00', 3, 'service-1')]).toSnapshot()
        .lines;

      expect(snapshot).toMatchObject({
        serviceId: 'service-1',
        description: 'Corte de cabello',
        unitPrice: '25.00',
        quantity: 3,
        lineTotal: '75.00',
      });
    });

    it('rejects a quantity that is not a whole number of items', () => {
      expect(() => line('25.00', 0)).toThrow(InvalidSaleDataError);
      expect(() => line('25.00', 1.5)).toThrow(InvalidSaleDataError);
      expect(() => line('25.00', 100)).toThrow(InvalidSaleDataError);
    });
  });

  describe('registration', () => {
    it('is PENDING without a payment method', () => {
      const sale = register();

      expect(sale.status).toBe(S.Pending);
      expect(sale.paidAt).toBeNull();
    });

    it('is PAID straight away when the client pays on the spot', () => {
      const sale = register([line('25.00')], {
        paymentMethod: PaymentMethod.Cash,
      });

      expect(sale.status).toBe(S.Paid);
      expect(sale.paidAt).toEqual(SOLD_AT);
    });

    it('freezes the currency of the business (rule SA-6)', () => {
      expect(register().toSnapshot().currency).toBe('PEN');
    });

    it('rejects a currency that is not an ISO-4217 code', () => {
      expect(() =>
        Sale.register(
          {
            id: 'sale-x',
            tenantId: 'tenant-1',
            currency: 'soles',
            lines: [line('25.00')],
            createdByUserId: null,
          },
          SOLD_AT,
        ),
      ).toThrow(InvalidSaleDataError);
    });
  });

  describe('lifecycle (rule SA-4)', () => {
    it('charges a pending sale', () => {
      const sale = register();

      sale.transitionTo(
        S.Paid,
        { actorUserId: 'user-1', paymentMethod: PaymentMethod.Card },
        LATER,
      );

      expect(sale.status).toBe(S.Paid);
      expect(sale.paymentMethod).toBe(PaymentMethod.Card);
      expect(sale.paidAt).toEqual(LATER);
    });

    it('refuses to charge without a payment method', () => {
      expect(() =>
        register().transitionTo(S.Paid, { actorUserId: 'user-1' }, LATER),
      ).toThrow(PaymentMethodRequiredError);
    });

    it('records who voided a sale and why', () => {
      const sale = register();

      sale.transitionTo(
        S.Cancelled,
        { actorUserId: 'user-9', reason: 'Cobrada dos veces' },
        LATER,
      );

      expect(sale.toSnapshot()).toMatchObject({
        status: S.Cancelled,
        voidReason: 'Cobrada dos veces',
        voidedByUserId: 'user-9',
        voidedAt: LATER,
      });
    });

    it('refuses to void without a reason', () => {
      expect(() =>
        register().transitionTo(S.Cancelled, { actorUserId: 'user-1' }, LATER),
      ).toThrow(VoidReasonRequiredError);

      expect(() =>
        register().transitionTo(
          S.Cancelled,
          { actorUserId: 'user-1', reason: '   ' },
          LATER,
        ),
      ).toThrow(VoidReasonRequiredError);
    });

    it('refunds a paid sale instead of cancelling it', () => {
      const sale = register([line('25.00')], {
        paymentMethod: PaymentMethod.Cash,
      });

      expect(() =>
        sale.transitionTo(
          S.Cancelled,
          { actorUserId: 'user-1', reason: 'Error' },
          LATER,
        ),
      ).toThrow(InvalidSaleTransitionError);

      sale.transitionTo(
        S.Refunded,
        { actorUserId: 'user-1', reason: 'Cliente devolvió el producto' },
        LATER,
      );

      expect(sale.status).toBe(S.Refunded);
    });

    it('leaves cancelled and refunded sales terminal', () => {
      expect(ALLOWED_TRANSITIONS[S.Cancelled]).toHaveLength(0);
      expect(ALLOWED_TRANSITIONS[S.Refunded]).toHaveLength(0);
    });

    it('keeps the amounts untouched when a sale is voided', () => {
      const sale = register([line('25.00')], {
        paymentMethod: PaymentMethod.Cash,
      });

      sale.transitionTo(
        S.Refunded,
        { actorUserId: 'user-1', reason: 'Error de cobro' },
        LATER,
      );

      expect(sale.total.toDecimalString()).toBe('25.00');
    });
  });

  describe('revenue (rule SA-5)', () => {
    it('counts only what was charged and kept', () => {
      expect(countsAsRevenue(S.Paid)).toBe(true);
      expect(countsAsRevenue(S.Pending)).toBe(false);
      expect(countsAsRevenue(S.Cancelled)).toBe(false);
      expect(countsAsRevenue(S.Refunded)).toBe(false);
    });
  });

  describe('restore', () => {
    it('round-trips a snapshot', () => {
      const original = register([line('25.00', 2)], {
        discount: '5.00',
        paymentMethod: PaymentMethod.Transfer,
      });

      expect(Sale.restore(original.toSnapshot()).toSnapshot()).toEqual(
        original.toSnapshot(),
      );
    });
  });
});
