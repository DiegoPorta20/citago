/**
 * Vertical a tenant belongs to.
 *
 * This is **data only**: no entity and no use case may branch on it. It drives
 * onboarding defaults and presentation labels, nothing else. When a vertical
 * needs its own rules, it gets its own module instead of an `if`.
 */
export enum BusinessType {
  Barbershop = 'BARBERSHOP',
  Salon = 'SALON',
  Spa = 'SPA',
  Clinic = 'CLINIC',
  Dental = 'DENTAL',
  Tattoo = 'TATTOO',
  Other = 'OTHER',
}

export const BUSINESS_TYPES = Object.values(BusinessType);
