import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { BusinessType } from '../../../../domain/business-type.js';
import { TenantStatus } from '../../../../domain/tenant-status.js';

/**
 * Persistence shape of a tenant (a business). No business logic lives here:
 * rules belong to the domain entity, this class only maps columns.
 */
@Entity('tenants')
export class TenantOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  /** Globally unique, human-readable handle. Used by support and, later, public booking pages. */
  @Index('uq_tenants_slug', { unique: true })
  @Column({ name: 'slug', type: 'varchar', length: 60 })
  slug: string;

  @Column({
    name: 'business_type',
    type: 'enum',
    enum: BusinessType,
    default: BusinessType.Barbershop,
  })
  businessType: BusinessType;

  /** ISO 3166-1 alpha-2. Default region when normalizing phone numbers. */
  @Column({ name: 'country', type: 'char', length: 2 })
  country: string;

  /** ISO 4217. The currency every amount of this tenant is expressed in. */
  @Column({ name: 'currency', type: 'char', length: 3 })
  currency: string;

  /** IANA time zone, e.g. `America/Lima`. Agenda and daily totals are computed in it. */
  @Column({ name: 'timezone', type: 'varchar', length: 64 })
  timezone: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'email', type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.Active,
  })
  status: TenantStatus;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
