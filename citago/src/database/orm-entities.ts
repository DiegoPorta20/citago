import { ServiceOrmEntity } from '../modules/catalog/infrastructure/persistence/typeorm/entities/service.orm-entity.js';
import { MembershipOrmEntity } from '../modules/identity/infrastructure/persistence/typeorm/entities/membership.orm-entity.js';
import { RefreshTokenOrmEntity } from '../modules/identity/infrastructure/persistence/typeorm/entities/refresh-token.orm-entity.js';
import { UserOrmEntity } from '../modules/identity/infrastructure/persistence/typeorm/entities/user.orm-entity.js';
import { TenantOrmEntity } from '../modules/tenants/infrastructure/persistence/typeorm/entities/tenant.orm-entity.js';

/**
 * Every persistence entity, registered explicitly.
 *
 * Globs were the obvious alternative, but TypeORM resolves them with dynamic
 * `import()` at runtime, which races with Jest's ESM teardown and silently
 * leaves entity metadata missing. Listing them costs one line per entity and
 * makes the set of tables obvious.
 *
 * **Add new `*.orm-entity.ts` classes here.**
 */
export const ORM_ENTITIES = [
  TenantOrmEntity,
  UserOrmEntity,
  MembershipOrmEntity,
  RefreshTokenOrmEntity,
  ServiceOrmEntity,
];
