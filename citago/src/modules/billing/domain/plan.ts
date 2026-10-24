import { Money } from '../../../shared/domain/money.js';
import { UnknownPlanError } from './billing.errors.js';

export enum PlanCode {
  Starter = 'STARTER',
  Pro = 'PRO',
  Business = 'BUSINESS',
}

export interface Plan {
  readonly code: PlanCode;
  readonly name: string;
  readonly monthlyPrice: Money;
  readonly currency: string;
  readonly maxStaff: number;
}

/** Soles: CitaGo sells in Peru first. Prices are the product's, not the gateway's. */
export const PLAN_CURRENCY = 'PEN';

export const PLANS: readonly Plan[] = [
  {
    code: PlanCode.Starter,
    name: 'Inicial',
    monthlyPrice: Money.fromDecimalString('39.00'),
    currency: PLAN_CURRENCY,
    maxStaff: 2,
  },
  {
    code: PlanCode.Pro,
    name: 'Profesional',
    monthlyPrice: Money.fromDecimalString('79.00'),
    currency: PLAN_CURRENCY,
    maxStaff: 5,
  },
  {
    code: PlanCode.Business,
    name: 'Negocio',
    monthlyPrice: Money.fromDecimalString('149.00'),
    currency: PLAN_CURRENCY,
    maxStaff: 15,
  },
];

/** The plan a new business starts its trial on (and the one the app highlights). */
export const DEFAULT_PLAN_CODE = PlanCode.Pro;

export function findPlan(code: string): Plan {
  const plan = PLANS.find((candidate) => String(candidate.code) === code);

  if (!plan) {
    throw new UnknownPlanError(code);
  }

  return plan;
}
