import { Tenant } from '../../../domain/tenant.entity.js';
import { TenantOrmEntity } from './entities/tenant.orm-entity.js';

/**
 * Translates between the persistence row and the domain entity.
 *
 * This is the only place allowed to know both shapes, which is what keeps
 * TypeORM decorators out of the domain.
 */
export const TenantMapper = {
  toDomain(row: TenantOrmEntity): Tenant {
    return Tenant.restore({
      id: row.id,
      name: row.name,
      slug: row.slug,
      businessType: row.businessType,
      country: row.country,
      currency: row.currency,
      timezone: row.timezone,
      phone: row.phone,
      email: row.email,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(tenant: Tenant): TenantOrmEntity {
    const snapshot = tenant.toSnapshot();
    const row = new TenantOrmEntity();

    row.id = snapshot.id;
    row.name = snapshot.name;
    row.slug = snapshot.slug;
    row.businessType = snapshot.businessType;
    row.country = snapshot.country;
    row.currency = snapshot.currency;
    row.timezone = snapshot.timezone;
    row.phone = snapshot.phone;
    row.email = snapshot.email;
    row.status = snapshot.status;
    row.createdAt = snapshot.createdAt;
    row.updatedAt = snapshot.updatedAt;

    return row;
  },
};
