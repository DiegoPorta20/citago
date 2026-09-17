import { type BusinessType } from './business-type.js';
import { InvalidTenantDataError } from './errors/invalid-tenant-data.error.js';
import { TenantStatus } from './tenant-status.js';

const MAX_NAME_LENGTH = 120;
const MAX_SLUG_LENGTH = 60;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export interface TenantSnapshot {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly businessType: BusinessType;
  readonly country: string;
  readonly currency: string;
  readonly timezone: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: TenantStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateTenantInput {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly businessType: BusinessType;
  readonly country: string;
  readonly currency: string;
  readonly timezone: string;
  readonly phone?: string | null;
  readonly email?: string | null;
}

/**
 * A business on the platform: the tenant every other record belongs to.
 *
 * `businessType` is data only. No behaviour here branches on it, and none
 * elsewhere may either: a vertical that needs its own rules gets its own
 * module.
 */
export class Tenant {
  private constructor(
    readonly id: string,
    private _name: string,
    readonly slug: string,
    readonly businessType: BusinessType,
    private _country: string,
    private _currency: string,
    private _timezone: string,
    private _phone: string | null,
    private _email: string | null,
    private _status: TenantStatus,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(input: CreateTenantInput, now: Date): Tenant {
    return new Tenant(
      input.id,
      assertName(input.name),
      assertSlug(input.slug),
      input.businessType,
      assertCountry(input.country),
      assertCurrency(input.currency),
      assertTimezone(input.timezone),
      input.phone ?? null,
      input.email ?? null,
      TenantStatus.Active,
      now,
      now,
    );
  }

  /** Rehydrates a tenant already stored; the invariants held when it was created. */
  static restore(snapshot: TenantSnapshot): Tenant {
    return new Tenant(
      snapshot.id,
      snapshot.name,
      snapshot.slug,
      snapshot.businessType,
      snapshot.country,
      snapshot.currency,
      snapshot.timezone,
      snapshot.phone,
      snapshot.email,
      snapshot.status,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get name(): string {
    return this._name;
  }

  get country(): string {
    return this._country;
  }

  get currency(): string {
    return this._currency;
  }

  get timezone(): string {
    return this._timezone;
  }

  get phone(): string | null {
    return this._phone;
  }

  get email(): string | null {
    return this._email;
  }

  get status(): TenantStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isActive(): boolean {
    return this._status === TenantStatus.Active;
  }

  rename(name: string, now: Date): void {
    this._name = assertName(name);
    this._updatedAt = now;
  }

  updateSettings(
    settings: {
      readonly country?: string;
      readonly currency?: string;
      readonly timezone?: string;
      readonly phone?: string | null;
      readonly email?: string | null;
    },
    now: Date,
  ): void {
    if (settings.country !== undefined) {
      this._country = assertCountry(settings.country);
    }
    if (settings.currency !== undefined) {
      this._currency = assertCurrency(settings.currency);
    }
    if (settings.timezone !== undefined) {
      this._timezone = assertTimezone(settings.timezone);
    }
    if (settings.phone !== undefined) {
      this._phone = settings.phone;
    }
    if (settings.email !== undefined) {
      this._email = settings.email;
    }

    this._updatedAt = now;
  }

  /** A tenant is never deleted; access is cut off instead. */
  suspend(now: Date): void {
    this._status = TenantStatus.Suspended;
    this._updatedAt = now;
  }

  reactivate(now: Date): void {
    this._status = TenantStatus.Active;
    this._updatedAt = now;
  }

  toSnapshot(): TenantSnapshot {
    return {
      id: this.id,
      name: this._name,
      slug: this.slug,
      businessType: this.businessType,
      country: this._country,
      currency: this._currency,
      timezone: this._timezone,
      phone: this._phone,
      email: this._email,
      status: this._status,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

function assertName(name: string): string {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    throw new InvalidTenantDataError('name', 'it cannot be empty');
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new InvalidTenantDataError(
      'name',
      `it cannot exceed ${MAX_NAME_LENGTH} characters`,
    );
  }

  return trimmed;
}

function assertSlug(slug: string): string {
  if (slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) {
    throw new InvalidTenantDataError(
      'slug',
      'it must be lowercase words separated by single hyphens',
    );
  }

  return slug;
}

function assertCountry(country: string): string {
  if (!COUNTRY_PATTERN.test(country)) {
    throw new InvalidTenantDataError(
      'country',
      'it must be an ISO 3166-1 alpha-2 code, e.g. PE',
    );
  }

  return country;
}

function assertCurrency(currency: string): string {
  if (!CURRENCY_PATTERN.test(currency)) {
    throw new InvalidTenantDataError(
      'currency',
      'it must be an ISO 4217 code, e.g. PEN',
    );
  }

  return currency;
}

function assertTimezone(timezone: string): string {
  try {
    // Validated against the runtime's own IANA database: an unknown zone would
    // silently break every agenda and daily total.
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw new InvalidTenantDataError(
      'timezone',
      'it must be an IANA time zone, e.g. America/Lima',
    );
  }

  return timezone;
}
