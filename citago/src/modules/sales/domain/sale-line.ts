import { Money } from '../../../shared/domain/money.js';
import { InvalidSaleDataError } from './sale.errors.js';

const MAX_DESCRIPTION_LENGTH = 160;
const MAX_QUANTITY = 99;

export interface SaleLineSnapshot {
  readonly id: string;
  /** The catalogue service this line came from, if any. */
  readonly serviceId: string | null;
  readonly description: string;
  /** Decimal string: what one unit cost **at the time of the sale**. */
  readonly unitPrice: string;
  readonly quantity: number;
  readonly lineTotal: string;
}

export interface CreateSaleLineInput {
  readonly id: string;
  readonly serviceId?: string | null;
  readonly description: string;
  readonly unitPrice: Money;
  readonly quantity: number;
}

/**
 * One charged item: a service, or anything else the shop sold.
 *
 * `description` and `unitPrice` are **snapshots** (rule SA-7). Renaming a
 * service or changing its price must never rewrite what a client was told they
 * were paying, so the line keeps its own copy and `serviceId` is kept only to
 * relate the sale back to the catalogue for reporting.
 *
 * Immutable: a sale is not edited (rule SA-4), so neither are its lines.
 */
export class SaleLine {
  private constructor(
    readonly id: string,
    readonly serviceId: string | null,
    readonly description: string,
    readonly unitPrice: Money,
    readonly quantity: number,
  ) {}

  static of(input: CreateSaleLineInput): SaleLine {
    return new SaleLine(
      input.id,
      input.serviceId ?? null,
      assertDescription(input.description),
      input.unitPrice,
      assertQuantity(input.quantity),
    );
  }

  static restore(snapshot: SaleLineSnapshot): SaleLine {
    return new SaleLine(
      snapshot.id,
      snapshot.serviceId,
      snapshot.description,
      Money.fromDecimalString(snapshot.unitPrice),
      snapshot.quantity,
    );
  }

  get total(): Money {
    return this.unitPrice.multiply(this.quantity);
  }

  toSnapshot(): SaleLineSnapshot {
    return {
      id: this.id,
      serviceId: this.serviceId,
      description: this.description,
      unitPrice: this.unitPrice.toDecimalString(),
      quantity: this.quantity,
      lineTotal: this.total.toDecimalString(),
    };
  }
}

function assertDescription(value: string): string {
  const description = value.trim();

  if (description.length === 0) {
    throw new InvalidSaleDataError('line description', 'it cannot be empty');
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new InvalidSaleDataError(
      'line description',
      `it cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }

  return description;
}

function assertQuantity(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_QUANTITY) {
    throw new InvalidSaleDataError(
      'line quantity',
      `it must be a whole number between 1 and ${MAX_QUANTITY}`,
    );
  }

  return value;
}
